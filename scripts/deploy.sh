#!/usr/bin/env bash
# ==============================================================================
# PalAutoBC — One-Step Production VPS Deployment & Service Registration
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
CURRENT_USER="$(id -un)"
NODE_BIN="$(which node || echo /usr/bin/node)"

echo "=== PalAutoBC Production Deployer ==="
echo "Application Directory: ${APP_DIR}"
echo "Current User: ${CURRENT_USER}"
echo "Node Binary: ${NODE_BIN}"

# Detect Palworld Server Directory
DETECTED_PAL_DIR=""
if pgrep -f 'PalServer' > /dev/null 2>&1; then
    PID=$(pgrep -f 'PalServer' | head -n 1)
    if [ -n "$PID" ] && [ -d "/proc/$PID/cwd" ]; then
        DETECTED_PAL_DIR=$(readlink -f "/proc/$PID/cwd")
        case "$DETECTED_PAL_DIR" in
            */Pal/Binaries/Linux*) DETECTED_PAL_DIR="$(dirname "$(dirname "$(dirname "$DETECTED_PAL_DIR")")")" ;;
            */Binaries/Linux*) DETECTED_PAL_DIR="$(dirname "$(dirname "$DETECTED_PAL_DIR")")" ;;
        esac
        echo "[INFO] Detected running Palworld server at: ${DETECTED_PAL_DIR}"
    fi
fi

if [ -z "$DETECTED_PAL_DIR" ] || [ ! -d "$DETECTED_PAL_DIR/Pal" ]; then
    CANDIDATES=(
        "/home/paladmin/palworld"
        "/home/paladmin/Palserver"
        "/home/paladmin/Steam/steamapps/common/PalServer"
        "/home/paladmin"
        "/home/steam/palworld"
        "/home/steam/Steam/steamapps/common/PalServer"
        "/home/steam/Palserver"
        "/home/ubuntu/palworld"
        "/home/ubuntu/Palserver"
        "/home/ubuntu/Steam/steamapps/common/PalServer"
    )
    for dir in "${CANDIDATES[@]}"; do
        if [ -d "$dir" ] && ([ -f "$dir/PalServer.sh" ] || [ -d "$dir/Pal" ]); then
            DETECTED_PAL_DIR="$dir"
            echo "[INFO] Found Palworld server files at: ${DETECTED_PAL_DIR}"
            break
        fi
    done
fi

if [ -z "$DETECTED_PAL_DIR" ]; then
    DETECTED_PAL_DIR="/home/${CURRENT_USER}/Palserver"
    echo "[WARN] Palworld server files not found in standard paths. Defaulting to: ${DETECTED_PAL_DIR}"
fi

echo "[1/4] Building PalAutoBC Frontend..."
cd "${APP_DIR}/frontend"
npm install --silent
npm run build

echo "[2/4] Building PalAutoBC Backend..."
cd "${APP_DIR}/backend"
npm install --silent
npm run build

echo "[3/4] Installing systemd service for user '${CURRENT_USER}'..."
rm -f "${APP_DIR}/data/.backup.lock"
cat <<EOF | sudo tee /etc/systemd/system/palautobc.service > /dev/null
[Unit]
Description=PalAutoBC - Palworld Dedicated Server Management Panel
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=${NODE_BIN} dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=0.0.0.0
Environment=PALWORLD_DIR=${DETECTED_PAL_DIR}
Environment=PALWORLD_PORT=8211
Environment=RCLONE_REMOTE=gdrive
Environment=RCLONE_BACKUP_FOLDER=PalworldBackups

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable palautobc.service

echo "[4/4] Starting PalAutoBC Unified Engine on Port 3000..."
sudo systemctl restart palautobc.service

echo "========================================================================"
echo "  PalAutoBC Dashboard is LIVE on http://YOUR_VPS_IP:3000"
echo "  Detected Palworld Path: ${DETECTED_PAL_DIR}"
echo "  Default Admin Credentials:"
echo "    Username: admin"
echo "    Password: PalAutoAdmin2026!"
echo "========================================================================"
