"""
Run inside the sap-b1-adapter-service container.
Reads MSSQL credentials from container env vars (DST_SERVER, DST_USER, DST_PASSWORD).
Executes infrastructure/mssql/init.sql against the mssql_server.
"""
import os, sys, pyodbc

server   = os.environ.get("DST_SERVER",   "mssql_server,1433")
user     = os.environ.get("DST_USER",     "sa")
password = os.environ.get("DST_PASSWORD", "")

conn_str = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"SERVER={server};"
    f"DATABASE=master;"
    f"UID={user};"
    f"PWD={password};"
    "Encrypt=no;"
    "TrustServerCertificate=yes;"
)

try:
    conn = pyodbc.connect(conn_str, autocommit=True, timeout=15)
except Exception as e:
    print(f"ERROR: cannot connect to {server} as {user}: {e}", file=sys.stderr)
    sys.exit(1)

sql_path = "/tmp/init.sql"
with open(sql_path) as f:
    sql = f.read()

batches = [b.strip() for b in sql.split("\nGO") if b.strip()]
print(f"Connected to {server}. Running {len(batches)} batches...")

errors = 0
for i, batch in enumerate(batches, 1):
    try:
        conn.execute(batch)
        print(f"  batch {i}: OK")
    except Exception as e:
        print(f"  batch {i}: ERROR — {e}", file=sys.stderr)
        errors += 1

conn.close()

if errors:
    print(f"\n{errors} batch(es) failed.", file=sys.stderr)
    sys.exit(1)

print("\nSchema initialized OK.")
