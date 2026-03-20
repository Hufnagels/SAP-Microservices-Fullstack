from shared.python_common.settings import CommonSettings


class Settings(CommonSettings):
    app_name: str = "opcua-service"

    # OPC-UA connection
    opcua_endpoint: str = "opc.tcp://192.168.0.1:4840"
    opcua_username: str = ""
    opcua_password: str = ""
    opcua_security_mode: str = "None"
    poll_interval_ms: int = 500

    # Shared JWT secret (same as auth-service)
    jwt_secret: str = "change-me-in-production-at-least-256-bits-long"
    jwt_algo: str = "HS256"

    # InfluxDB — timeseries persistence
    influxdb_url: str = "http://influxdb:8086"
    influxdb_token: str = "my-super-secret-token"
    influxdb_org: str = "compani"
    influxdb_bucket: str = "opcua"

    # PostgreSQL — node definitions
    postgres_url: str = "postgresql://postgres:postgres@postgres-opcua:5432/opcua_db"
