"""
JWT verification for file-service.
Uses the same JWT_SECRET as auth-service (stateless, no DB lookup required).
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from .settings import settings

_bearer = HTTPBearer()


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_auth(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Return the JWT payload {sub, role, ...}. Raises 401 on failure."""
    return _decode(creds.credentials)
