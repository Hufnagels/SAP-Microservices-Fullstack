#!/bin/bash
# Creates multiple databases in a single Postgres instance.
# Triggered by docker-entrypoint-initdb.d on first start (empty data directory).
# Reads database names from POSTGRES_MULTIPLE_DATABASES env var (comma-separated).

set -e

if [ -z "$POSTGRES_MULTIPLE_DATABASES" ]; then
  echo "POSTGRES_MULTIPLE_DATABASES not set — skipping"
  exit 0
fi

echo "Creating databases: $POSTGRES_MULTIPLE_DATABASES"

for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
    SELECT 'CREATE DATABASE $db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
SQL
  echo "  $db: ready"
done

echo "All databases created."
