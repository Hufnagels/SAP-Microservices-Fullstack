"""
JWT creation/verification and bcrypt password hashing.
Ported from sap/backend/app3/app/middleware/auth.py — adapted for PostgreSQL auth-service.
"""
import base64
import hashlib
import logging
from datetime import datetime, timedelta

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

log = logging.getLogger(__name__)

_bearer = HTTPBearer()

# Populated at startup from settings
_jwt_secret: str = ""
_jwt_algo: str = "HS256"
_jwt_expire_hours: int = 8


def configure(jwt_secret: str, jwt_algo: str, jwt_expire_hours: int):
    global _jwt_secret, _jwt_algo, _jwt_expire_hours
    _jwt_secret = jwt_secret
    _jwt_algo = jwt_algo
    _jwt_expire_hours = jwt_expire_hours


# ---------------------------------------------------------------------------
# Password hashing (SHA-256 pre-hash to stay within bcrypt's 72-byte limit)
# ---------------------------------------------------------------------------

def _pre_hash(password: str) -> str:
    return base64.b64encode(hashlib.sha256(password.encode()).digest()).decode()


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(_pre_hash(password).encode(), _bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(_pre_hash(password).encode(), hashed.encode())


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_token(username: str, role: str, service_roles: dict | None = None) -> str:
    payload = {
        "sub":           username,
        "role":          role,
        "service_roles": service_roles or {},
        "exp":           datetime.utcnow() + timedelta(hours=_jwt_expire_hours),
    }
    return jwt.encode(payload, _jwt_secret, algorithm=_jwt_algo)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _jwt_secret, algorithms=[_jwt_algo])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """FastAPI dependency: validates Bearer JWT and returns payload (no role check)."""
    return decode_token(creds.credentials)


def require_roles(roles: list[str]):
    """FastAPI dependency: validates Bearer JWT and checks role membership."""
    def _dep(creds: HTTPAuthorizationCredentials = Depends(_bearer)):
        payload = decode_token(creds.credentials)
        if payload.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload
    return _dep
