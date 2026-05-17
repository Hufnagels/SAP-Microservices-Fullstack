from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

_bearer = HTTPBearer()
_secret = ""
_algo   = "HS256"


def configure(secret: str, algo: str = "HS256"):
    global _secret, _algo
    _secret = secret
    _algo   = algo


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _secret, algorithms=[_algo])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    return decode_token(creds.credentials)


def require_admin(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    payload = decode_token(creds.credentials)
    if payload.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin required")
    return payload
