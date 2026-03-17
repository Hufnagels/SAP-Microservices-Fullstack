from shared.python_common.settings import CommonSettings


class Settings(CommonSettings):
    app_name: str = "auth-service"
    postgres_url: str = "postgresql://postgres:postgres@postgres-auth:5432/auth_db"
    jwt_secret: str = "change-me-in-production-at-least-256-bits-long"
    jwt_algo: str = "HS256"
    jwt_expire_hours: int = 8
    min_password_length: int = 6
    # Bootstrap admin — created on startup if DB has no users
    bootstrap_admin_username: str = ""
    bootstrap_admin_password: str = ""
