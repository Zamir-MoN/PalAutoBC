#!/usr/bin/env bash
set -euo pipefail

echo "[INFO] Gracefully stopping Palworld server..."
pkill -TERM -f 'PalServer' || true

for i in {1..15}; do
    if ! pgrep -f 'PalServer-Linux' > /dev/null 2>&1; then
        echo "[INFO] Palworld server stopped cleanly."
        exit 0
    fi
    sleep 1
done

echo "[WARN] Server did not stop within 15s. Issuing SIGKILL..."
pkill -9 -f 'PalServer' || true
echo "[INFO] Server stopped."

