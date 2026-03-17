from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class LabelField(BaseModel):
    key: str = Field(..., description="Field identifier")
    value: str = Field(..., description="Field value to print on label")


class LabelRequest(BaseModel):
    template: str = Field(..., description="Label template name")
    fields: List[LabelField] = Field(..., description="Data fields for the label")
    copies: int = Field(1, ge=1, le=100, description="Number of copies to print")
    printer: Optional[str] = Field(None, description="Target printer name; uses default if omitted")


class LabelResponse(BaseModel):
    job_id: str
    template: str
    copies: int
    printer: str
    status: str


class PrinterInfo(BaseModel):
    name: str
    is_default: bool
    status: str


class RawPrintRequest(BaseModel):
    zpl: str = Field(..., description="Raw ZPL string to send to the printer")


class LabelDesignTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Unique template name")
    description: Optional[str] = Field(None, description="Optional description")
    size_w_mm: float = Field(..., gt=0, description="Label width in mm")
    size_h_mm: float = Field(..., gt=0, description="Label height in mm")
    elements_json: str = Field(..., description="JSON-encoded LabelElement array")
    preview_b64: Optional[str] = Field(None, description="PNG preview as base64 data URL")


class LabelDesignTemplateOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    size_w_mm: float
    size_h_mm: float
    elements_json: str
    preview_b64: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
