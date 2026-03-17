"""
SAP B1 Service Layer integration
"""
import re
import socket
import logging
from urllib.parse import urlparse
from typing import Dict, Any, Optional

import requests

from app.settings import Settings as _Settings

_s = _Settings()
B1_BASE_URL = _s.b1_base_url
B1_VERSION = _s.b1_version
COMPANY_DB = _s.b1_company_db
B1_USER = _s.b1_user
B1_PASSWORD = _s.b1_password


log = logging.getLogger(__name__)

_odata_escape_re = re.compile(r"_x([0-9A-Fa-f]{4})_")


class VPNConnectionError(Exception):
    """Raised when VPN connection to SAP B1 server is not available"""
    def __init__(self, message: str, details: dict = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)

    def to_json(self):
        """Convert error to JSON-serializable dict"""
        return {
            "error": True,
            "error_code": "VPN_NOT_CONNECTED",
            "message": self.message,
            "details": self.details
        }


def check_vpn_connection(timeout: int = 5) -> bool:
    """
    Check if VPN tunnel to SAP B1 server is active

    Args:
        timeout: Connection timeout in seconds

    Returns:
        True if connection is successful, False otherwise

    Raises:
        VPNConnectionError: If VPN connection is not available
    """
    # Parse the SAP B1 URL to extract host and port
    parsed_url = urlparse(B1_BASE_URL)
    host = parsed_url.hostname
    port = parsed_url.port or (443 if parsed_url.scheme == 'https' else 80)

    log.info(f"Checking VPN connection to SAP B1 server: {host}:{port}")

    try:
        # Try to establish a TCP connection to the SAP server
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()

        if result == 0:
            log.info(f"✓ VPN connection verified - SAP B1 server reachable at {host}:{port}")
            return True
        else:
            log.error(f"✗ VPN connection failed - Cannot reach SAP B1 server at {host}:{port}")
            raise VPNConnectionError(
                message=f"VPN connection required - SAP B1 server not reachable",
                details={
                    "server": host,
                    "port": port,
                    "error_code": result,
                    "troubleshooting": [
                        "Check if OpenVPN or your VPN client is running",
                        "Verify VPN credentials and configuration",
                        f"Test connectivity: ping {host}",
                        "Check VPN tunnel status",
                        "Ensure network routes are configured correctly"
                    ]
                }
            )
    except socket.gaierror as e:
        # DNS resolution failed
        log.error(f"✗ DNS resolution failed for {host}: {e}")
        raise VPNConnectionError(
            message=f"Cannot resolve SAP B1 server hostname - VPN may not be connected",
            details={
                "server": host,
                "error": str(e),
                "troubleshooting": [
                    "Check if VPN is connected",
                    "Verify VPN DNS settings",
                    f"Check if hostname '{host}' is correct",
                    "Test DNS resolution: nslookup {host}"
                ]
            }
        )
    except socket.timeout:
        log.error(f"✗ Connection timeout to {host}:{port}")
        raise VPNConnectionError(
            message=f"Connection timeout to SAP B1 server - VPN likely not connected",
            details={
                "server": host,
                "port": port,
                "timeout": timeout,
                "troubleshooting": [
                    "Check if VPN is connected and active",
                    "Verify firewall allows VPN traffic",
                    "Increase timeout if network is slow",
                    "Check VPN tunnel status"
                ]
            }
        )
    except Exception as e:
        log.error(f"✗ Unexpected error checking VPN connection: {e}")
        raise VPNConnectionError(
            message=f"Failed to verify VPN connection to SAP B1 server",
            details={
                "server": host,
                "port": port,
                "error": str(e),
                "error_type": type(e).__name__
            }
        )


def b1_url(path: str) -> str:
    """Build full SAP B1 Service Layer URL"""
    return f"{B1_BASE_URL}/{B1_VERSION}/{path.lstrip('/')}"


def decode_odata_key(key: str) -> str:
    """Decode OData escaped characters in field names"""
    return _odata_escape_re.sub(lambda m: chr(int(m.group(1), 16)), key)


def remap_row_keys(row: Dict[str, Any], force_map: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Remap row keys by decoding OData escapes and applying force_map"""
    decoded = {decode_odata_key(k): v for k, v in row.items()}
    if not force_map:
        return decoded
    return {force_map.get(k, k): v for k, v in decoded.items()}


def fetch_b1_rows(
    sql_code: str,
    create_if_missing: bool,
    sql_text: Optional[str],
    verify: bool,
    force_labels: Optional[Dict[str, str]]
) -> list[dict]:
    """
    Fetch rows from SAP B1 Service Layer using SQLQueries

    Args:
        sql_code: SAP B1 SQLQuery code
        create_if_missing: Create query if it doesn't exist
        sql_text: SQL query text (used when creating)
        verify: SSL verification
        force_labels: Optional column label mapping

    Returns:
        List of row dictionaries

    Raises:
        VPNConnectionError: If VPN connection is not available
    """
    # Check VPN connection before attempting to connect
    check_vpn_connection(timeout=5)

    rows_all = []
    log.info("Connecting to SAP B1 Service Layer...")

    with requests.Session() as s:
        # Login
        login_payload = {
            "CompanyDB": COMPANY_DB,
            "UserName": B1_USER,
            "Password": B1_PASSWORD
        }
        r = s.post(b1_url("/Login"), json=login_payload, verify=verify, timeout=30)
        r.raise_for_status()

        try:
            # Ensure query exists in SAP B1
            chk = s.get(b1_url(f"/SQLQueries('{sql_code}')"), verify=verify, timeout=30)
            if chk.status_code == 404:
                if not create_if_missing or not sql_text:
                    raise RuntimeError(
                        f"Query '{sql_code}' not found in SAP B1. "
                        "Save the query in Query Builder first so it can be auto-created on sync."
                    )
                # SAP B1 SqlCode is limited to 20 characters
                if len(sql_code) > 20:
                    raise RuntimeError(
                        f"Query name '{sql_code}' is {len(sql_code)} characters — "
                        "SAP B1 SqlCode must be ≤ 20 characters. "
                        "Rename the query in Query Builder to a shorter name."
                    )
                create_payload = {
                    "SqlCode": sql_code,
                    "SqlName": sql_code,
                    "SqlText": sql_text,
                }
                log.info("Creating SQLQuery '%s' in SAP B1", sql_code)
                cr = s.post(b1_url("/SQLQueries"), json=create_payload, verify=verify, timeout=30)
                if not cr.ok:
                    b1_detail = ""
                    try:
                        b1_detail = cr.json().get("error", {}).get("message", {}).get("value", cr.text)
                    except Exception:
                        b1_detail = cr.text
                    log.error("SAP B1 create failed [%s]: %s", cr.status_code, b1_detail)
                    raise RuntimeError(
                        f"SAP B1 rejected SQLQuery creation ({cr.status_code}): {b1_detail}"
                    )

            # Execute query
            ex = s.post(b1_url(f"/SQLQueries('{sql_code}')/List"), json={}, verify=verify, timeout=120)
            ex.raise_for_status()
            data = ex.json()

            def extract(payload):
                """Extract value array from OData response"""
                r = payload.get("value") or payload
                if isinstance(r, dict) and "value" in r:
                    r = r["value"]
                return r if isinstance(r, list) else []

            # First page
            rows = extract(data)
            rows_all.extend(remap_row_keys(r, None) for r in rows)

            # Pagination
            next_link = data.get("odata.nextLink") or data.get("@odata.nextLink")
            while next_link:
                if not next_link.startswith("http"):
                    next_link = f"{B1_BASE_URL}/{B1_VERSION}/{next_link.lstrip('/')}"
                pg = s.get(next_link, verify=verify, timeout=120)
                pdata = pg.json()
                rows = extract(pdata)
                rows_all.extend(remap_row_keys(r, None) for r in rows)
                next_link = pdata.get("odata.nextLink") or pdata.get("@odata.nextLink")

        finally:
            s.post(b1_url("/Logout"), verify=verify, timeout=15)

    return rows_all
