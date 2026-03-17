"""
Stateless JWT verification + API key auth for sap-b1-adapter.
Validates tokens issued by auth-service using the shared JWT_SECRET.
No database lookup needed — JWT is self-contained.
"""
import json
import logging
from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

log = logging.getLogger(__name__)

_bearer = HTTPBearer()
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

_jwt_secret: str = ""
_jwt_algo: str = "HS256"
_api_keys: dict = {}   # key_value → role


def configure(jwt_secret: str, jwt_algo: str, api_keys_json: str):
    global _jwt_secret, _jwt_algo, _api_keys
    _jwt_secret = jwt_secret
    _jwt_algo = jwt_algo
    try:
        _api_keys = json.loads(api_keys_json)
    except Exception:
        log.warning("Could not parse API_KEYS_JSON — API key auth disabled")
        _api_keys = {}


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


def require_api_key(roles: list[str]):
    """Dependency: validates X-API-Key header and checks role."""
    def _dep(api_key: str = Depends(_api_key_header)):
        role = _api_keys.get(api_key)
        if role not in roles:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return role
    return _dep
