#!/usr/bin/env bash
# Start the GitHub Interest Radar server on macOS / Linux.
set -euo pipefail

HOST="${RADAR_HOST:-127.0.0.1}"
PORT="${RADAR_PORT:-4173}"

cd "$(dirname "$0")/.."
exec python3 -m server.app --host "$HOST" --port "$PORT"
