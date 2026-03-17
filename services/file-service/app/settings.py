from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "file-service"
    postgres_url: str = "postgresql://postgres:postgres@postgres-files:5432/files_db"
    storage_dir: str = "/app/storage"
    jwt_secret: str = "change-me-in-production-at-least-256-bits-long"

    class Config:
        env_file = ".env"


settings = Settings()
