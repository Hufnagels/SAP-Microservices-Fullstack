FROM python:3.11-slim

# Install ODBC Driver 18 for SQL Server
# - apt-key is removed in Debian 12 (Bookworm); use gpg --dearmor instead
# - msodbcsql18 supports Debian 12 and ARM64 (Mac M1/M2/M3)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl gpg apt-transport-https ca-certificates unixodbc-dev \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list \
        -o /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/sap-b1-adapter-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY shared /app/shared
COPY services/sap-b1-adapter-service /app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
