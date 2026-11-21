"""Entry point: `python -m server.app` (or python server/app.py)."""

from __future__ import annotations

import argparse
import socket
from http.server import ThreadingHTTPServer

from .auth import current_token
from .config import DEFAULT_HOST, DEFAULT_PORT
from .handler import RadarHandler


def _lan_addresses() -> list[str]:
    """Best-effort list of local IPv4 addresses for the LAN hint."""
    addresses: set[str] = set()
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            addresses.add(info[4][0])
    except OSError:
        pass
    return sorted(address for address in addresses if not address.startswith("127."))


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the GitHub interest radar.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--host", default=DEFAULT_HOST)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), RadarHandler)
    print(f"GitHub radar running at http://{args.host}:{args.port}")
    if args.host in {"0.0.0.0", ""}:
        for address in _lan_addresses():
            print(f"  LAN: http://{address}:{args.port}")
    print(f"GitHub API auth: {'token' if current_token() else 'anonymous'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
