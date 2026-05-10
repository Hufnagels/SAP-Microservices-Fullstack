"""
On-demand OpenVPN tunnel manager.

Opens the tunnel on first SAP B1 request, keeps it alive while active,
disconnects after VPN_IDLE_TTL seconds with no activity.
Raises VPNConnectionError on failure so existing route-handler except clauses
work without any changes.

Env vars
--------
VPN_CONFIG           Path to .conf inside container  (default: /etc/vpn/brd.conf)
VPN_TARGET_HOST      Host to probe for connectivity  (default: 172.22.248.4)
VPN_TARGET_PORT      Port to probe                   (default: 50000)
VPN_CONNECT_TIMEOUT  Seconds to wait for tun up      (default: 30)
VPN_IDLE_TTL         Idle seconds before disconnect  (default: 300)
VPN_BYPASS           Skip everything when true        (default: false)
"""
import logging
import os
import socket
import subprocess
import threading
import time

from shared.python_common.vpn_check import VPNConnectionError

log = logging.getLogger(__name__)

VPN_CONFIG   = os.getenv("VPN_CONFIG",         "/etc/vpn/brd.conf")
VPN_TARGET   = os.getenv("VPN_TARGET_HOST",    "172.22.248.4")
VPN_PORT     = int(os.getenv("VPN_TARGET_PORT",     "50000"))
VPN_TIMEOUT  = int(os.getenv("VPN_CONNECT_TIMEOUT", "30"))
VPN_IDLE_TTL = int(os.getenv("VPN_IDLE_TTL",        "300"))
VPN_BYPASS   = os.getenv("VPN_BYPASS", "false").strip().lower() in ("1", "true", "yes")


class VPNManager:
    """Thread-safe, on-demand OpenVPN tunnel with idle auto-disconnect."""

    def __init__(self):
        self._lock       = threading.Lock()
        self._proc: subprocess.Popen | None = None
        self._last_used  = 0.0
        self._idle_timer: threading.Timer | None = None

    # ── Public ────────────────────────────────────────────────────────────────

    def ensure_connected(self) -> None:
        """Call before any SAP B1 request. No-op when VPN_BYPASS=true.
        Raises VPNConnectionError if the tunnel cannot be established."""
        if VPN_BYPASS:
            log.debug("VPN check bypassed (VPN_BYPASS=true)")
            return
        with self._lock:
            self._last_used = time.time()
            if self._probe():
                self._reset_idle_timer()
                return
            log.info("VPN not up — starting tunnel …")
            try:
                self._start()
            except (RuntimeError, TimeoutError) as exc:
                raise VPNConnectionError(
                    message=str(exc),
                    details={"server": VPN_TARGET, "port": VPN_PORT},
                ) from exc
            self._reset_idle_timer()

    # ── Internal ──────────────────────────────────────────────────────────────

    def _probe(self) -> bool:
        """TCP probe to SAP B1 server. Returns True if reachable."""
        try:
            s = socket.socket()
            s.settimeout(3)
            ok = s.connect_ex((VPN_TARGET, VPN_PORT)) == 0
            s.close()
            return ok
        except Exception:
            return False

    def _start(self) -> None:
        # /dev/net/tun must exist — requires PVE `lxc.mount.entry: /dev/net/tun` or tun=1 feature.
        # Without it, VPN must be started on the LXC host; this probe-only path handles that case.
        if not os.path.exists("/dev/net/tun"):
            raise RuntimeError(
                f"{VPN_TARGET}:{VPN_PORT} unreachable and /dev/net/tun not available in this "
                "container. Start OpenVPN on the LXC host, or enable tun=1 in the PVE LXC config "
                "(see OVPN_Guide.md §12)."
            )
        self._stop()
        self._proc = subprocess.Popen(
            ["openvpn", "--config", VPN_CONFIG, "--verb", "3"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        deadline = time.time() + VPN_TIMEOUT
        while time.time() < deadline:
            time.sleep(1)
            if self._probe():
                log.info("VPN tunnel up ✓  (%s:%s reachable)", VPN_TARGET, VPN_PORT)
                return
            if self._proc.poll() is not None:
                out = self._proc.stdout.read().decode(errors="replace")[-500:]
                raise RuntimeError(f"openvpn exited early:\n{out}")
        self._stop()
        raise TimeoutError(f"VPN tunnel not up after {VPN_TIMEOUT}s")

    def _stop(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        self._proc = None

    def _reset_idle_timer(self) -> None:
        if self._idle_timer:
            self._idle_timer.cancel()
        self._idle_timer = threading.Timer(VPN_IDLE_TTL, self._idle_disconnect)
        self._idle_timer.daemon = True
        self._idle_timer.start()

    def _idle_disconnect(self) -> None:
        with self._lock:
            if time.time() - self._last_used >= VPN_IDLE_TTL:
                log.info("VPN idle timeout (%ds) — disconnecting", VPN_IDLE_TTL)
                self._stop()


# Module-level singleton — one tunnel shared across all sync requests
_manager = VPNManager()


def get_vpn_manager() -> VPNManager:
    return _manager
