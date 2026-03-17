from sqlalchemy import create_engine, Column, String, Float, Text, DateTime, LargeBinary
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone
import os

DATABASE_URL = os.getenv(
    "POSTGRES_URL",
    "postgresql://postgres:postgres@localhost:5432/labeling_db",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class LabelDesignTemplate(Base):
    __tablename__ = "label_templates"

    id          = Column(String, primary_key=True)
    name        = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    size_w_mm   = Column(Float, nullable=False)
    size_h_mm   = Column(Float, nullable=False)
    elements_json = Column(Text, nullable=False)
    preview     = Column(LargeBinary, nullable=True)
    created_at  = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
