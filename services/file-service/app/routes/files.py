"""
files.py — All /files/* endpoints.

Routes:
  GET    /files/health
  GET    /files/           → List[FileItem]  (no content_base64; filtered by uploader unless superadmin)
  GET    /files/{id}       → FileItem        (with content_base64; owner or superadmin)
  POST   /files/           → FileItem        (body includes content_base64 data-URL; records uploader)
  PUT    /files/{id}       → FileItem        (update metadata; owner or superadmin)
  DELETE /files/{id}       → 204             (removes DB row + physical file; owner or superadmin)

Physical storage
  Files are saved to {STORAGE_DIR}/{folder}/{uuid}{ext}
  where STORAGE_DIR is mounted from the host ./files/ volume.
"""
import base64
import mimetypes
import os
import uuid as uuid_mod
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import database as db
from ..security import require_auth
from ..settings import settings

router = APIRouter(prefix="/files", tags=["files"], redirect_slashes=False)

STORAGE = settings.storage_dir


# ── Pydantic models ───────────────────────────────────────────────────────────

class FileItem(BaseModel):
    id:              int
    name:            str
    mime_type:       str
    size:            int
    description:     str
    tags:            list[str]
    uploaded:        str
    project:         str
    folder:          str
    uploaded_by:     str
    content_base64:  Optional[str] = None


class FileUpload(BaseModel):
    name:           str
    mime_type:      str
    size:           int
    description:    str = ""
    tags:           list[str] = []
    uploaded:       str = ""
    project:        str = ""
    folder:         str = ""
    content_base64: str       # data-URL from FileReader.readAsDataURL


class FileUpdate(BaseModel):
    description: str = ""
    tags:        list[str] = []
    project:     str = ""
    folder:      str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_dataurl(data_url: str) -> bytes:
    """Strip the 'data:...;base64,' prefix and decode."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return base64.b64decode(data_url)


def _guess_ext(mime_type: str, filename: str) -> str:
    ext = os.path.splitext(filename)[1]
    if ext:
        return ext
    guessed = mimetypes.guess_extension(mime_type) or ""
    return guessed


def _save_file(folder: str, filename: str, mime_type: str, data: bytes) -> str:
    """Write data to STORAGE/{folder}/{uuid}{ext}. Returns relative file_path."""
    ext = _guess_ext(mime_type, filename)
    unique_name = str(uuid_mod.uuid4()) + ext
    rel = os.path.join(folder, unique_name) if folder else unique_name
    abs_path = os.path.join(STORAGE, rel)
    os.makedirs(os.path.dirname(abs_path) if folder else STORAGE, exist_ok=True)
    with open(abs_path, "wb") as f:
        f.write(data)
    return rel


def _read_as_dataurl(file_path: str, mime_type: str) -> str:
    abs_path = os.path.join(STORAGE, file_path)
    with open(abs_path, "rb") as f:
        raw = f.read()
    encoded = base64.b64encode(raw).decode()
    return f"data:{mime_type};base64,{encoded}"


def _delete_physical(file_path: str):
    abs_path = os.path.join(STORAGE, file_path)
    try:
        os.remove(abs_path)
        # Remove empty parent folder (but not STORAGE itself)
        parent = os.path.dirname(abs_path)
        if parent != STORAGE and os.path.isdir(parent) and not os.listdir(parent):
            os.rmdir(parent)
    except FileNotFoundError:
        pass


def _check_owner_or_superadmin(file_id: int, payload: dict):
    """Raise 403 if the requester is neither the file owner nor a superadmin."""
    if payload.get("role") == "superadmin":
        return
    owner = db.get_file_owner(file_id)
    if owner is None:
        raise HTTPException(status_code=404, detail="File not found")
    if owner != payload.get("sub"):
        raise HTTPException(status_code=403, detail="You can only modify your own files")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "file-service"}


@router.get("/", response_model=list[FileItem])
def get_files(payload: dict = Depends(require_auth)):
    # Superadmin sees all files; everyone else sees only their own
    if payload.get("role") == "superadmin":
        return db.list_files()
    return db.list_files(uploaded_by=payload["sub"])


@router.get("/{file_id}", response_model=FileItem)
def get_file(file_id: int, payload: dict = Depends(require_auth)):
    row = db.get_file(file_id)
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    # Non-superadmin can only fetch their own files
    if payload.get("role") != "superadmin" and row.get("uploaded_by") != payload.get("sub"):
        raise HTTPException(status_code=403, detail="You can only view your own files")
    file_path = row.pop("file_path")
    try:
        row["content_base64"] = _read_as_dataurl(file_path, row["mime_type"])
    except FileNotFoundError:
        row["content_base64"] = None
    return row


@router.post("/", response_model=FileItem, status_code=201)
def upload_file(payload_data: FileUpload, payload: dict = Depends(require_auth)):
    raw = _decode_dataurl(payload_data.content_base64)
    file_path = _save_file(payload_data.folder, payload_data.name, payload_data.mime_type, raw)
    row = db.insert_file(
        name=payload_data.name,
        mime_type=payload_data.mime_type,
        size=payload_data.size,
        description=payload_data.description,
        tags=payload_data.tags,
        uploaded=payload_data.uploaded,
        project=payload_data.project,
        folder=payload_data.folder,
        file_path=file_path,
        uploaded_by=payload["sub"],
    )
    return row


@router.put("/{file_id}", response_model=FileItem)
def update_file(file_id: int, payload_data: FileUpdate, payload: dict = Depends(require_auth)):
    _check_owner_or_superadmin(file_id, payload)
    row = db.update_file(
        file_id=file_id,
        description=payload_data.description,
        tags=payload_data.tags,
        project=payload_data.project,
        folder=payload_data.folder,
    )
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    row.pop("file_path", None)
    return row


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: int, payload: dict = Depends(require_auth)):
    _check_owner_or_superadmin(file_id, payload)
    file_path = db.delete_file(file_id)
    if file_path is None:
        raise HTTPException(status_code=404, detail="File not found")
    _delete_physical(file_path)


@router.get("/{file_id}/stream")
def stream_file(file_id: int, payload: dict = Depends(require_auth)):
    """Stream the raw file bytes — supports range requests (needed for video seeking)."""
    row = db.get_file(file_id)
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    if payload.get("role") != "superadmin" and row.get("uploaded_by") != payload.get("sub"):
        raise HTTPException(status_code=403, detail="You can only view your own files")
    abs_path = os.path.join(STORAGE, row["file_path"])
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        abs_path,
        media_type=row["mime_type"],
        filename=row["name"],
        headers={"Accept-Ranges": "bytes"},
    )
