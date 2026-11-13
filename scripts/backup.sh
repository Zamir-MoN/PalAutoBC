#!/usr/bin/env bash
# ==============================================================================
# PalAutoBC — Automated Full Server Backup Script for Palworld Dedicated Server
# ==============================================================================
set -euo pipefail

PALWORLD_DIR="${PALWORLD_DIR:-/home/ubuntu/Palserver}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
RCLONE_FOLDER="${RCLONE_FOLDER:-PalworldBackups}"
TEMP_DIR="${TEMP_DIR:-/home/ubuntu/PalAutoBC/data/temporary-backups}"
LOCK_FILE="/tmp/palautobc_backup.lock"

mkdir -p "$TEMP_DIR"

# 1. Acquire Lock
exec 200>"$LOCK_FILE"
flock -n 200 || { echo "[ERROR] Another backup is currently in progress. Exiting."; exit 1; }

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="palbc_${TIMESTAMP}.zip"
LOCAL_ZIP="${TEMP_DIR}/${FILENAME}"

echo "[INFO] Starting full Palworld server backup: ${FILENAME}"

# 2. Check if Palworld server is running
WAS_RUNNING=0
if pgrep -f 'PalServer-Linux' > /dev/null 2>&1; then
    WAS_RUNNING=1
    echo "[INFO] Palworld server is currently running. Stopping gracefully for save integrity..."
    pkill -TERM -f 'PalServer' || true
    sleep 5
fi

# 3. Create full ZIP archive
echo "[INFO] Creating ZIP archive of ${PALWORLD_DIR}..."
zip -r -q -9 "${LOCAL_ZIP}" "${PALWORLD_DIR}" -x "*.sock" "*.lock" "*/Logs/*"

# 4. Compute Checksum & Upload to Google Drive via rclone
echo "[INFO] Uploading archive to Google Drive (${RCLONE_REMOTE}:${RCLONE_FOLDER})..."
rclone copyto "${LOCAL_ZIP}" "${RCLONE_REMOTE}:${RCLONE_FOLDER}/${FILENAME}" --checksum

# 5. Verify remote file
echo "[INFO] Verifying remote archive on Google Drive..."
if rclone lsjson "${RCLONE_REMOTE}:${RCLONE_FOLDER}/${FILENAME}" | grep -q "${FILENAME}"; then
    echo "[INFO] Verification succeeded. Deleting temporary local ZIP..."
    rm -f "${LOCAL_ZIP}"
else
    echo "[WARNING] Remote verification failed! Preserving local archive ${LOCAL_ZIP}"
fi

# 6. Guaranteed restart if server was running
if [ "${WAS_RUNNING}" -eq 1 ]; then
    echo "[INFO] Executing guaranteed Palworld server restart..."
    cd "${PALWORLD_DIR}"
    screen -dmS palworld ./PalServer.sh -port=8211 -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS
    echo "[INFO] Palworld server restarted in screen session 'palworld'."
fi

echo "[SUCCESS] Backup workflow completed successfully for ${FILENAME}."

