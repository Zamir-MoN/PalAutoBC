# PalAutoBC — Palworld Dedicated Server Management Panel

A high-performance, self-hosted web management dashboard and automated disaster recovery engine for Palworld dedicated servers on Ubuntu Linux.

![Dashboard Preview](https://img.shields.io/badge/PalAutoBC-v1.0.0-A3E635?style=for-the-badge&logo=server)
![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat&logo=node.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat&logo=tailwind-css)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?style=flat&logo=sqlite)

---

## Key Features

- **⚡ Instant Backups (< 3 seconds)**: Fast native compression of `Pal/Saved` (~100MB instead of 6GB) with zero-downtime RCON world flush.
- **☁️ Google Drive Cloud Storage**: Direct `rclone` integration with unlimited retention, automatic verification, and newest-first chronological sorting.
- **⬇️ Direct Local Downloads**: One-click download button in the dashboard to save backup `.zip` archives directly to your personal computer.
- **🎯 100% Accurate Player Counter**: Source RCON `ShowPlayers` queries coupled with UDP port 8211 socket inspection—zero false positives.
- **🖥️ Live Console & Command Terminal**: Real-time log streaming from `PalServer.log` and GNU Screen buffer with dual-delivery execution.
- **🛠️ Safe Configuration Editor**: Visual form and direct Raw INI editor with automatic rollback snapshots stored in SQLite.
- **💎 Luxury Glassmorphism UI**: High-end obsidian dark theme (`#08090C`) with ambient lime/emerald lighting and responsive telemetry meters.

---

## System Architecture

- **Web Server & Backend API**: Node.js + Express + TypeScript on **Port 3000**
  - **No external reverse proxies (No Nginx / Apache / Caddy required)**
  - Express serves the React SPA, REST endpoints (`/api/v1/*`), and WebSockets (`/ws`) from the single unified HTTP instance.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + GSAP.
- **Dedicated Game Server**: Palworld on **Port 8211** (located at `/home/paladmin/palworld`).
- **Metadata Database**: SQLite in WAL mode (`palautobc.sqlite`).
- **Cloud Backup**: `rclone` integration with Google Drive (format: `palbc_YYYY-MM-DD_HH-MM-SS.zip`).

---

## Production Deployment on VPS

```bash
# 1. Clone repository to VPS
cd ~
git clone https://github.com/Zamir-MoN/PalAutoBC.git
cd PalAutoBC

# 2. Deploy dashboard service
chmod +x scripts/*.sh
bash ./scripts/deploy.sh
```

### Accessing the Dashboard

Navigate to:
```
http://YOUR_VPS_IP:3000
```

- **Default Username**: `admin`
- **Default Password**: `PalAutoAdmin2026!`

---

## Full Documentation

For the complete technical architecture, INI settings reference, multiplier breakdown, and maintenance guide, see:
👉 [**PALAUTOBC_SYSTEM_GUIDE.md**](./PALAUTOBC_SYSTEM_GUIDE.md)

---

## License

Private / MIT License. Developed for PalAutoBC dedicated servers.
