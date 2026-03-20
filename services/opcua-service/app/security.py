"""
Stateless JWT verification for opcua-service.
Validates tokens issued by auth-service using the shared JWT_SECRET.
"""
import logging
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

log = logging.getLogger(__name__)

_bearer = HTTPBearer()
_jwt_secret: str = ""
_jwt_algo: str = "HS256"


def configure(jwt_secret: str, jwt_algo: str):
    global _jwt_secret, _jwt_algo
    _jwt_secret = jwt_secret
    _jwt_algo = jwt_algo


def _decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, _jwt_secret, algorithms=[_jwt_algo])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_jwt(roles: list[str]):
    """Dependency: validates Bearer JWT and checks role."""
    def _dep(creds: HTTPAuthorizationCredentials = Depends(_bearer)):
        payload = _decode_jwt(creds.credentials)
        if payload.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload
    return _dep
