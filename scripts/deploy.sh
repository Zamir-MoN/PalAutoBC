#!/usr/bin/env bash
# ==============================================================================
# PalAutoBC — One-Step Production VPS Deployment & Service Registration
# ==============================================================================
set -euo pipefail

APP_DIR="/home/ubuntu/PalAutoBC"
echo "[1/5] Building PalAutoBC Frontend..."
cd "${APP_DIR}/frontend"
npm install --silent
npm run build

echo "[2/5] Building PalAutoBC Backend..."
cd "${APP_DIR}/backend"
npm install --silent
npm run build

echo "[3/5] Setting up systemd service..."
sudo cp "${APP_DIR}/scripts/palautobc.service" /etc/systemd/system/palautobc.service
sudo systemctl daemon-reload
sudo systemctl enable palautobc.service

echo "[4/5] Starting PalAutoBC Unified Engine on Port 3000..."
sudo systemctl restart palautobc.service

echo "[5/5] Verifying Service Health..."
sleep 2
sudo systemctl status palautobc.service --no-pager

echo "========================================================================"
echo "  PalAutoBC Dashboard is LIVE on http://YOUR_VPS_IP:3000"
echo "  Default Admin Credentials:"
echo "    Username: admin"
echo "    Password: PalAutoAdmin2026!"
echo "========================================================================"

