from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_url: str = "postgresql://postgres:postgres@postgres-lot:5432/lot_db"
    jwt_secret: str   = "change-me-in-production-at-least-256-bits-long"
    jwt_algo: str     = "HS256"
    labeling_url: str = "http://labeling-service:8000"

    model_config = {"env_file": ".env"}
