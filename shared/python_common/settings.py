from pydantic_settings import BaseSettings, SettingsConfigDict

class CommonSettings(BaseSettings):
    app_name: str = "service"
    app_env: str = "dev"
    app_port: int = 8000
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    otel_enabled: bool = False
    prometheus_enabled: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
