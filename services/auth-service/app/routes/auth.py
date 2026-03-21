"""
Auth routes: login, me, health, and user CRUD (admin).
"""
import json
import logging
import subprocess
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.database import (
    get_conn, list_users, get_user, get_user_by_username, update_user, delete_user,
    get_permissions, set_permissions, ROLE_RANK,
    list_services, get_service, create_service, update_service, delete_service,
)
from app import security

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"], redirect_slashes=False)

VALID_ROLES = {"superadmin", "admin", "operator", "viewer", "worker"}

# ── Request / Response models ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"
    name: Optional[str] = None
    email: Optional[str] = None
    service_roles: dict = {}
    avatar_mode: Optional[str] = "letter"
    avatar_base64: Optional[str] = None


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    service_roles: Optional[dict] = None
    status: Optional[str] = None   # "active" | "inactive"
    password: Optional[str] = None
    avatar_mode: Optional[str] = None
    avatar_base64: Optional[str] = None


class UpdateMeRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    avatar_mode: Optional[str] = None   # "letter" | "image"
    avatar_base64: Optional[str] = None
    password: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "auth-service"}


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash, role, is_active, service_roles FROM auth_users WHERE username = %s",
                (req.username,),
            )
            row = cur.fetchone()

    if not row or not row[2]:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_hash, role, _, service_roles = row
    if not security.verify_password(req.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = security.create_token(req.username, role, service_roles=service_roles or {})
    return TokenResponse(access_token=token, role=role)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: dict = Depends(security.get_current_user)):
    """Issue a fresh token for the currently authenticated user (token must still be valid)."""
    token = security.create_token(payload["sub"], payload["role"], service_roles=payload.get("service_roles", {}))
    return TokenResponse(access_token=token, role=payload["role"])


@router.get("/me")
def me(payload: dict = Depends(security.require_roles(["superadmin", "admin", "operator", "viewer"]))):
    user = get_user_by_username(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/me")
def update_me(req: UpdateMeRequest,
              payload: dict = Depends(security.require_roles(["superadmin", "admin", "operator", "viewer"]))):
    from app.settings import Settings
    settings = Settings()

    password_hash = None
    if req.password:
        if len(req.password) < settings.min_password_length:
            raise HTTPException(
                status_code=400,
                detail=f"Password must be at least {settings.min_password_length} characters",
            )
        password_hash = security.hash_password(req.password)

    user = get_user_by_username(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    row = update_user(
        user["id"],
        name=req.name,
        email=req.email,
        avatar_mode=req.avatar_mode,
        avatar_base64=req.avatar_base64,
        password_hash=password_hash,
    )
    return row


# ── User CRUD (admin only) ────────────────────────────────────────────────────

@router.get("/users", dependencies=[Depends(security.require_roles(["admin", "superadmin"]))])
def get_users():
    return list_users()


@router.post("/users", dependencies=[Depends(security.require_roles(["admin", "superadmin"]))])
def create_user(req: CreateUserRequest):
    from app.settings import Settings
    settings = Settings()

    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Valid: {sorted(VALID_ROLES)}")
    if len(req.password) < settings.min_password_length:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {settings.min_password_length} characters",
        )

    password_hash = security.hash_password(req.password)
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO auth_users "
                    "(username, password_hash, role, name, email, service_roles, avatar_mode, avatar_base64) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                    (req.username, password_hash, req.role,
                     req.name or req.username, req.email or "", json.dumps(req.service_roles),
                     req.avatar_mode or "letter", req.avatar_base64),
                )
                new_id = cur.fetchone()[0]
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=400, detail="Username already exists")
        raise HTTPException(status_code=500, detail="Database error")

    return get_user(new_id)


@router.put("/users/{user_id}")
def put_user(user_id: int, req: UpdateUserRequest,
             payload: dict = Depends(security.require_roles(["admin", "superadmin"]))):
    from app.settings import Settings
    settings = Settings()

    if req.role and req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Valid: {sorted(VALID_ROLES)}")

    # Enforce role hierarchy: requester must outrank the target user
    requester_role = payload["role"]
    requester      = get_user_by_username(payload["sub"])
    target = get_user(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    is_self = requester and requester["id"] == user_id
    if not is_self and ROLE_RANK.get(requester_role, 0) < ROLE_RANK.get(target["role"], 0):
        raise HTTPException(status_code=403, detail=f"Insufficient permissions to modify a '{target['role']}' user")
    # Prevent promoting a user above the requester's own rank (even self)
    if req.role and ROLE_RANK.get(req.role, 0) > ROLE_RANK.get(requester_role, 0):
        raise HTTPException(status_code=403, detail=f"Cannot assign role '{req.role}' — insufficient permissions")

    password_hash = None
    if req.password:
        if len(req.password) < settings.min_password_length:
            raise HTTPException(
                status_code=400,
                detail=f"Password must be at least {settings.min_password_length} characters",
            )
        password_hash = security.hash_password(req.password)

    is_active = None
    if req.status is not None:
        is_active = req.status == "active"

    row = update_user(
        user_id,
        name=req.name,
        email=req.email,
        role=req.role,
        service_roles=req.service_roles,
        is_active=is_active,
        password_hash=password_hash,
        avatar_mode=req.avatar_mode,
        avatar_base64=req.avatar_base64,
        clear_avatar=req.avatar_mode == "letter",
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row


@router.delete("/users/{user_id}")
def remove_user(user_id: int,
                payload: dict = Depends(security.require_roles(["admin", "superadmin"]))):
    target = get_user(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    requester_role = payload["role"]
    if ROLE_RANK.get(requester_role, 0) < ROLE_RANK.get(target["role"], 0):
        raise HTTPException(status_code=403, detail=f"Insufficient permissions to delete a '{target['role']}' user")
    if not delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted", "id": user_id}


# ── Permissions map ───────────────────────────────────────────────────────────

@router.get("/permissions",
            dependencies=[Depends(security.require_roles(["superadmin", "admin", "operator", "viewer"]))])
def read_permissions():
    return get_permissions()


@router.put("/permissions",
            dependencies=[Depends(security.require_roles(["superadmin"]))])
def write_permissions(perms: dict):
    return set_permissions(perms)


# ── Legacy endpoint (kept for backward compat) ────────────────────────────────

@router.post("/create-user", dependencies=[Depends(security.require_roles(["admin", "superadmin"]))])
def create_user_legacy(req: CreateUserRequest):
    return create_user(req)


# ── Service registry ──────────────────────────────────────────────────────────

class ServiceCreateRequest(BaseModel):
    name: str
    pascal_name: Optional[str] = None
    description: Optional[str] = None
    service_url: Optional[str] = None
    port: Optional[int] = None
    make_command: Optional[str] = None
    api_endpoint: Optional[str] = None


class ServiceUpdateRequest(BaseModel):
    pascal_name: Optional[str] = None
    description: Optional[str] = None
    service_url: Optional[str] = None
    port: Optional[int] = None
    make_command: Optional[str] = None
    api_endpoint: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/services")
def read_services(
    active_only: bool = False,
    _: dict = Depends(security.require_roles(["superadmin", "admin", "operator", "viewer"])),
):
    return list_services(active_only=active_only)


@router.get("/services/{service_id}")
def read_service(
    service_id: int,
    _: dict = Depends(security.require_roles(["superadmin", "admin", "operator", "viewer"])),
):
    svc = get_service(service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc


@router.post("/services", status_code=201)
def add_service(
    req: ServiceCreateRequest,
    _: dict = Depends(security.require_roles(["superadmin", "admin"])),
):
    try:
        return create_service(**req.model_dump())
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Service '{req.name}' already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/services/{service_id}")
def edit_service(
    service_id: int,
    req: ServiceUpdateRequest,
    _: dict = Depends(security.require_roles(["superadmin", "admin"])),
):
    svc = update_service(service_id, **req.model_dump(exclude_none=True))
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc


@router.delete("/services/{service_id}", status_code=204)
def remove_service(
    service_id: int,
    _: dict = Depends(security.require_roles(["superadmin"])),
):
    if not delete_service(service_id):
        raise HTTPException(status_code=404, detail="Service not found")


class ServiceActionRequest(BaseModel):
    action: str  # "start" | "stop" | "restart"


@router.post("/services/{service_id}/action", summary="Start / stop / restart a service container")
def service_action(
    service_id: int,
    req: ServiceActionRequest,
    _: dict = Depends(security.require_roles(["superadmin", "admin"])),
):
    if req.action not in ("start", "stop", "restart"):
        raise HTTPException(status_code=400, detail=f"Invalid action '{req.action}'. Use start, stop, or restart.")

    svc = get_service(service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    container = f"microservices-{svc['name']}-1"
    cmd = ["docker", req.action, container]
    log.info("Service action: %s %s", req.action, container)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return {
            "action": req.action,
            "service": svc["name"],
            "container": container,
            "returncode": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Docker CLI not found. Ensure /var/run/docker.sock is mounted and docker.io is installed.",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail=f"Docker {req.action} timed out after 60s")
    except Exception as e:
        log.exception("Service action failed")
        raise HTTPException(status_code=500, detail=str(e))
