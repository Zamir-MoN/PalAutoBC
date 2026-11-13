#!/usr/bin/env bash
# ==============================================================================
# PalAutoBC — Fast Zero-Downtime Backup Script for Palworld Dedicated Server
# ==============================================================================
set -euo pipefail

# Auto-detect Palworld server directory across common paths
if [ -d "/home/paladmin/palworld" ]; then
    PAL_DIR="/home/paladmin/palworld"
elif [ -d "/home/paladmin/Palserver" ]; then
    PAL_DIR="/home/paladmin/Palserver"
elif [ -d "/home/steam/palworld" ]; then
    PAL_DIR="/home/steam/palworld"
elif [ -d "/home/ubuntu/Palserver" ]; then
    PAL_DIR="/home/ubuntu/Palserver"
else
    PAL_DIR="${HOME}/palworld"
fi

RCLONE_REMOTE="gdrive"
RCLONE_FOLDER="PalworldBackups"
TEMP_DIR="${HOME}/PalAutoBC/data/temporary-backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="palbc_${TIMESTAMP}.zip"
LOCAL_ZIP="${TEMP_DIR}/${FILENAME}"

mkdir -p "${TEMP_DIR}"

echo "=================================================="
echo " PalAutoBC: Manual Palworld Backup to Google Drive"
echo "=================================================="
echo "[1/4] Target directory : ${PAL_DIR}/Pal/Saved"
echo "[2/4] Destination file : ${FILENAME}"

if [ ! -d "${PAL_DIR}/Pal/Saved" ]; then
    echo "[ERROR] Pal/Saved directory not found in ${PAL_DIR}!"
    exit 1
fi

echo "[3/4] Creating compressed archive of world & player save data..."
cd "${PAL_DIR}"
zip -r -q "${LOCAL_ZIP}" Pal/Saved PalServer.sh -x "*.sock" "*.lock" "*.tmp" 2>/dev/null || \
zip -r -q "${LOCAL_ZIP}" Pal/Saved -x "*.sock" "*.lock" "*.tmp"

ARCHIVE_SIZE=$(du -h "${LOCAL_ZIP}" | cut -f1)
echo "[INFO] Archive generated (${ARCHIVE_SIZE})."

echo "[4/4] Uploading to Google Drive (${RCLONE_REMOTE}:${RCLONE_FOLDER})..."
rclone copyto "${LOCAL_ZIP}" "${RCLONE_REMOTE}:${RCLONE_FOLDER}/${FILENAME}" --checksum -P

echo "[INFO] Verifying archive on Google Drive..."
if rclone lsjson "${RCLONE_REMOTE}:${RCLONE_FOLDER}/${FILENAME}" | grep -q "${FILENAME}"; then
    echo "[SUCCESS] Remote verification passed!"
    rm -f "${LOCAL_ZIP}"
    echo "[INFO] Cleaned up temporary local archive."
else
    echo "[WARNING] Remote verification check failed. Local archive kept at: ${LOCAL_ZIP}"
fi

echo "=================================================="
echo " Backup Completed Successfully: ${FILENAME}"
echo "=================================================="
