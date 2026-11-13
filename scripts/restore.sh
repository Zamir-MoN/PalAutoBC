#!/usr/bin/env bash
# ==============================================================================
# PalAutoBC — Disaster Recovery & Full Restoration Script
# ==============================================================================
set -euo pipefail

TARGET_ARCHIVE="${1:-}"
if [ -z "$TARGET_ARCHIVE" ]; then
    echo "Usage: $0 <archive_filename.zip>"
    exit 1
fi

PALWORLD_DIR="${PALWORLD_DIR:-/home/ubuntu/Palserver}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_FOLDER="${RCLONE_FOLDER:-PalworldBackups}"
STAGING_DIR="/tmp/palautobc_staging"
SAFETY_BACKUP="/home/ubuntu/PalAutoBC/data/temporary-backups/safety_snapshot_$(date +%s).zip"

mkdir -p "$STAGING_DIR"

echo "[INFO] Downloading ${TARGET_ARCHIVE} from Google Drive..."
rclone copyto "${RCLONE_REMOTE}:${RCLONE_FOLDER}/${TARGET_ARCHIVE}" "${STAGING_DIR}/${TARGET_ARCHIVE}"

echo "[INFO] Validating archive integrity and extracting to staging..."
unzip -q -o "${STAGING_DIR}/${TARGET_ARCHIVE}" -d "${STAGING_DIR}/extracted"

if [ ! -d "${STAGING_DIR}/extracted" ]; then
    echo "[ERROR] Extraction failed. Aborting restore."
    exit 1
fi

echo "[INFO] Gracefully stopping active Palworld server..."
pkill -TERM -f 'PalServer' || true
sleep 5

echo "[INFO] Creating pre-restore safety snapshot of current installation..."
zip -r -q -9 "${SAFETY_BACKUP}" "${PALWORLD_DIR}" || true

echo "[INFO] Deploying verified files to ${PALWORLD_DIR}..."
cp -rf "${STAGING_DIR}/extracted/." "${PALWORLD_DIR}/"

echo "[INFO] Enforcing permissions..."
chmod +x "${PALWORLD_DIR}/PalServer.sh"
chown -R ubuntu:ubuntu "${PALWORLD_DIR}"

echo "[INFO] Starting restored Palworld server in screen session 'palworld'..."
cd "${PALWORLD_DIR}"
screen -dmS palworld ./PalServer.sh -port=8211 -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS

rm -rf "$STAGING_DIR"
echo "[SUCCESS] Palworld server restored and restarted successfully."

