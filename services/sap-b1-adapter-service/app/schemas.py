"""
Pydantic models for request/response validation
"""
from typing import Optional, Dict
from pydantic import BaseModel, Field


class SyncRequest(BaseModel):
    """
    Request model for SAP B1 → SQL Server sync.
    """

    # SAP B1
    sql_code: str = Field(
        default="My_OpenOrders",
        description="SAP B1 SQLQuery code (Service Layer SQLQueries.SqlCode)",
        example="My_OpenOrders"
    )

    create_if_missing: bool = Field(
        default=True,
        description="Create SQLQuery in SAP B1 if it does not exist"
    )

    sql_text: Optional[str] = Field(
        default=None,
        description="SQL text used only if create_if_missing=true and query does not exist"
    )

    # Destination
    dst_table: str = Field(
        default="qry_SalesOrders",
        description="Destination SQL Server table name",
        example="qry_SalesOrders"
    )

    dst_schema: str = Field(
        default="dbo",
        description="Destination SQL Server schema",
        example="dbo"
    )

    load_mode: str = Field(
        default="replace",
        description="Data load mode: replace (truncate) or append",
        pattern="^(replace|append)$",
        example="replace"
    )

    # Optional behavior
    force_labels: Optional[Dict[str, str]] = Field(
        default=None,
        description="Optional column rename map; null disables renaming",
        example={
            "DocNum": "Rendelés szám",
            "DocDate": "Rendelés dátum"
        }
    )

    dry_run: bool = Field(
        default=False,
        description="If true, fetch data but do not write to SQL Server"
    )


class CreateUserRequest(BaseModel):
    """Request model for creating a new user"""
    username: str
    password: str
    role: str


class LoginRequest(BaseModel):
    """Request model for user login"""
    username: str
    password: str
