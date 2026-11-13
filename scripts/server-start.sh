#!/usr/bin/env bash
set -euo pipefail

PALWORLD_DIR="${PALWORLD_DIR:-/home/ubuntu/Palserver}"
SESSION="palworld"

if pgrep -f 'PalServer-Linux' > /dev/null 2>&1; then
    echo "[WARN] Palworld server is already running."
    exit 0
fi

cd "${PALWORLD_DIR}"
chmod +x ./PalServer.sh
screen -dmS "${SESSION}" ./PalServer.sh -port=8211 -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS
echo "[INFO] Palworld server started in GNU Screen session '${SESSION}' on port 8211."

