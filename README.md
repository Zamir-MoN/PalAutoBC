# PalAutoBC — Palworld Dedicated Server Management Panel

A modern, production-grade, self-hosted web dashboard and automated backup engine for Palworld dedicated servers on Ubuntu Linux.

---

## Architecture Overview

- **Web Server & Backend API**: Node.js + Express + TypeScript on **Port 3000**
  - **No external reverse proxies (No Nginx / Apache / Caddy)**
  - Express serves the React SPA, REST endpoints (`/api/v1/*`), and WebSockets (`/ws`) from the same HTTP server
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + GSAP + TanStack Query + Lucide Icons
  - Dark-mode minimalist UI inspired by Linear, Vercel, and Raycast
  - Responsive layout with iOS safe-area inset support
- **Dedicated Game Server**: Palworld on **Port 8211** (located at `/home/ubuntu/Palserver`)
- **Metadata Database**: SQLite in WAL mode (`palautobc.sqlite`)
- **Cloud Backup**: `rclone` integration with Google Drive (format: `palbc_YYYY-MM-DD_HH-MM-SS.zip`)
- **Process Supervisor**: GNU Screen & systemd support with crash detection and guaranteed restart error handling

---

## Production Deployment on VPS

### 1. Transfer Project to VPS
From your local machine or repository, clone/upload this `PalAutoBC` folder to:
```bash
/home/ubuntu/PalAutoBC
```

### 2. Execute One-Step Deployment
```bash
cd /home/ubuntu/PalAutoBC/scripts
chmod +x deploy.sh backup.sh restore.sh server-start.sh server-stop.sh
./deploy.sh
```

The script will automatically:
1. Build the production React frontend bundle into `backend/public`
2. Build the TypeScript backend into `backend/dist`
3. Install and enable the systemd service `/etc/systemd/system/palautobc.service`
4. Start the unified web server on port `3000`

---

## Accessing the Dashboard

Open your browser and navigate to:
```
http://YOUR_VPS_IP:3000
```

### Default Admin Credentials
- **Username**: `admin`
- **Password**: `PalAutoAdmin2026!`

*(You can change the password at any time via the API or settings.)*

---

## Features & Verification

| Module | Capability | Implementation |
| :--- | :--- | :--- |
| **Server Controls** | Start, stop, restart | Prevents duplicate instances, verifies PID and port 8211 listener |
| **Automated Backups** | Daily 03:00 UTC | Graceful stop $\rightarrow$ ZIP $\rightarrow$ SHA256 $\rightarrow$ rclone upload $\rightarrow$ remote verification $\rightarrow$ guaranteed restart in finally |
| **Disaster Recovery** | Zero-risk restore | Pre-restore safety snapshot, staged extraction, `Level.sav` validation, permission enforcement |
| **Config Editor** | `PalWorldSettings.ini` | Visual form, pre-save snapshot history, rollback support |
| **Player Moderation** | Online roster | RCON integration for Kick, Ban, Server Broadcasts, and instant Save |
| **Live Console** | PalServer.log stream | Real-time WebSocket streaming, auto-scroll, log filtering, command execution |
| **File Manager** | Sandboxed explorer | Restricts access to `/home/ubuntu/Palserver`, file editor, rename, delete |
| **VPS Telemetry** | System stats | Real-time CPU, RAM, Disk, Network, and Palworld process resource gauges |

---

## Service Management Commands

```bash
# Check service status
sudo systemctl status palautobc

# View live dashboard logs
sudo journalctl -u palautobc -f

# Restart dashboard service
sudo systemctl restart palautobc
```

