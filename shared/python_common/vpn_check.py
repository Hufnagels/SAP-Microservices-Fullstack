"""
shared/python_common/vpn_check.py
──────────────────────────────────────────────────────────────────────────────
Global VPN / connectivity check used by any service that needs to reach an
external server over a VPN tunnel.

Env vars
--------
VPN_BYPASS=true          Skip the TCP probe entirely (useful in dev/test or
                         when the target is accessible without a VPN client).
VPN_CHECK_TIMEOUT=5      TCP connection timeout in seconds (default: 5).

Usage
-----
from shared.python_common.vpn_check import check_vpn_connection, VPNConnectionError

check_vpn_connection(host="172.22.248.4", port=50000)
"""

import os
import socket
import logging

log = logging.getLogger(__name__)

VPN_BYPASS: bool = os.getenv("VPN_BYPASS", "false").strip().lower() in ("1", "true", "yes")
VPN_CHECK_TIMEOUT: int = int(os.getenv("VPN_CHECK_TIMEOUT", "5"))


class VPNConnectionError(Exception):
    def __init__(self, message: str, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)

    def to_json(self) -> dict:
        return {
            "error": True,
            "error_code": "VPN_NOT_CONNECTED",
            "message": self.message,
            "details": self.details,
        }


def check_vpn_connection(host: str, port: int, timeout: int | None = None) -> None:
    """
    Verify that *host:port* is reachable via a TCP probe.

    Does nothing when VPN_BYPASS=true.
    Raises VPNConnectionError on any failure.
    """
    if VPN_BYPASS:
        log.debug("VPN check bypassed (VPN_BYPASS=true) for %s:%s", host, port)
        return

    t = timeout if timeout is not None else VPN_CHECK_TIMEOUT
    log.info("VPN check → %s:%s (timeout=%ss)", host, port, t)

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(t)
        result = sock.connect_ex((host, port))
        sock.close()

        if result == 0:
            log.info("VPN check OK — %s:%s reachable", host, port)
            return

        log.error("VPN check FAILED — %s:%s unreachable (err %s)", host, port, result)
        raise VPNConnectionError(
            message=f"VPN connection required — {host}:{port} not reachable",
            details={"server": host, "port": port, "error": f"connect_ex={result}"},
        )

    except socket.gaierror as e:
        log.error("VPN check FAILED — DNS error for %s: %s", host, e)
        raise VPNConnectionError(
            message=f"Cannot resolve host '{host}' — VPN may not be connected",
            details={"server": host, "port": port, "error": str(e)},
        )

    except socket.timeout:
        log.error("VPN check FAILED — timeout connecting to %s:%s", host, port)
        raise VPNConnectionError(
            message=f"Timeout connecting to {host}:{port} — VPN likely not active",
            details={"server": host, "port": port, "timeout": t},
        )

    except VPNConnectionError:
        raise

    except Exception as e:
        log.error("VPN check FAILED — unexpected error for %s:%s: %s", host, port, e)
        raise VPNConnectionError(
            message=f"Failed to verify connection to {host}:{port}",
            details={"server": host, "port": port, "error": str(e), "error_type": type(e).__name__},
        )
