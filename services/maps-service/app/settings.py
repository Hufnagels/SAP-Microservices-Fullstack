from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "maps-service"
    postgres_url: str = "postgresql://postgres:postgres@postgres:5432/maps_db"
    jwt_secret: str = "change-me-in-production-at-least-256-bits-long"

    class Config:
        env_file = ".env"


settings = Settings()
