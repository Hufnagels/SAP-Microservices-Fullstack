from shared.python_common.settings import CommonSettings


class Settings(CommonSettings):
    app_name: str = "sap-b1-adapter-service"

    # SAP B1 Service Layer
    b1_base_url: str = "https://172.22.248.4:50000/b1s"
    b1_version: str = "v1"
    b1_company_db: str = "BRD_PS_20250407"
    b1_user: str = "termelesig"
    b1_password: str = ""
    b1_verify_ssl: bool = False

    # Destination MSSQL (ReportingDB)
    mssql_driver: str = "ODBC Driver 18 for SQL Server"
    dst_server: str = "localhost,1433"
    dst_db: str = "ReportingDB"
    dst_user: str = "sa"
    dst_password: str = ""
    dst_trusted: bool = False
    dst_schema: str = "dbo"

    # Shared JWT secret (same as auth-service)
    jwt_secret: str = "change-me-in-production-at-least-256-bits-long"
    jwt_algo: str = "HS256"

    # Static API keys (role → key mapping, JSON string)
    api_keys_json: str = '{"superadmin":"yaDwo_UZP_EiRLkto2ZM","admin":"_gGtQUDDTW39pUPIFJUI","operator":"-zeQcXj0z1KIKXxx8Ewo","viewer":"We4bc3cHqkZKY3KWchiy"}'
