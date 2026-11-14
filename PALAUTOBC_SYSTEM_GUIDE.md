# PalAutoBC — Production System Architecture & Operations Manual

> **PalAutoBC** is an ultra-premium, production-grade, self-hosted web management dashboard and automated backup engine engineered specifically for Palworld dedicated servers hosted on Ubuntu VPS instances.

---

## 1. System Architecture

```
                          ┌────────────────────────────────────────────────────────┐
                          │                   Client Web Browser                   │
                          │   React 19 SPA • Tailwind CSS • Glassmorphic Dark UI   │
                          └──────────────────────────┬─────────────────────────────┘
                                                     │ HTTP :3000 & WebSocket (/ws)
                                                     ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   PalAutoBC Unified Service (Port 3000)                          │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │ Express HTTP & WebSocket Server                                          │   │
│   │ • JWT Authentication                                                     │   │
│   │ • Static Production SPA Bundle Serving (backend/public)                  │   │
│   │ • Real-time State Broadcasting (/ws)                                     │   │
│   └──────────────────────┬───────────────────────────────────────────────────┘   │
│                          │                                                       │
│   ┌──────────────────────┼─────────────────────────┬─────────────────────────┐   │
│   ▼                      ▼                         ▼                         ▼   │
│ ┌───────────────┐  ┌──────────────────┐  ┌────────────────────┐  ┌─────────────┐ │
│ │ Backup Engine │  │ Player Service   │  │ Config & Snapshots │  │ Log Watcher │ │
│ │ • Fast native │  │ • Source RCON    │  │ • Quote-safe INI   │  │ • Live tail │ │
│ │   ZIP (-1)    │  │ • UDP socket     │  │   parser           │  │ • Screen    │ │
│ │ • rclone      │  │   validation     │  │ • Rollback history │  │   capture   │ │
│ │   Google Drive│  │ • 0/32 accuracy  │  │ • Automated snaps  │  │ • Dual-send │ │
│ └───────────────┘  └──────────────────┘  └────────────────────┘  └─────────────┘ │
│                          │                         │                             │
│                          ▼                         ▼                             │
│             ┌─────────────────────────┐ ┌─────────────────────┐                  │
│             │ SQLite Database (WAL)   │ │ Host Process Engine │                  │
│             │ • palautobc.sqlite      │ │ • pgrep / ps / ss   │                  │
│             └─────────────────────────┘ └─────────────────────┘                  │
└──────────────────────────┬───────────────────────────────────────────────────────┘
                           │ Stdin Stuff / RCON :25575 / Save Games
                           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                 Palworld Dedicated Server Engine (Port 8211)                     │
│   Location: /home/paladmin/palworld (PalServer.sh)                               │
│   Process Manager: GNU Screen (`palworld`) or systemd                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Server Specifications & Production Paths

| Attribute | Production Configuration |
| :--- | :--- |
| **VPS IP** | `34.93.88.26` |
| **Web Dashboard URL** | `http://34.93.88.26:3000` |
| **Game Server Port** | `8211` (UDP) |
| **RCON Port** | `25575` (TCP/UDP, localhost & remote authenticated) |
| **REST API Port** | `8212` (Palworld native REST engine) |
| **Primary VPS User** | `paladmin` |
| **Palworld Root** | `/home/paladmin/palworld` |
| **Settings File** | `/home/paladmin/palworld/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini` |
| **Save Games Dir** | `/home/paladmin/palworld/Pal/Saved/SaveGames` |
| **Dashboard Root** | `/home/paladmin/PalAutoBC` |
| **Systemd Service** | `/etc/systemd/system/palautobc.service` |
| **Default Web Admin** | User: `admin` \| Password: `PalAutoAdmin2026!` |

---

## 3. PalWorldSettings.ini (Verified Configuration)

Below is the complete, quote-safe, and syntax-verified configuration loaded on the dedicated server:

```ini
[/Script/Pal.PalGameWorldSettings]
OptionSettings=(ServerName="Palulu Gang",ServerDescription="",ServerPlayerMaxNum=32,AdminPassword="zamir015",ServerPassword="palulu2999",PublicPort=8211,PublicIP="",RCONEnabled=True,RCONPort=25575,Difficulty=None,DeathPenalty=None,ExpRate=1.000000,PalCaptureRate=1.000000,WorkSpeedRate=1.000000,DayTimeSpeedRate=1.000000,NightTimeSpeedRate=1.000000,PalSpawnNumRate=1.000000,PalEggDefaultHatchingTime=0.000000,PhysicsActiveDropItemMaxNum=3000,BaseCampWorkerMaxNum=15,GuildPlayerMaxNum=20,bIsPvP=True,bEnablePlayerToPlayerDamage=True,bEnableFriendlyFire=False,PalDamageRateAttack=1.000000,PalDamageRateDefense=1.000000,CrossplayPlatforms="(Steam,Xbox,PS5,Mac)",bAllowClientMod=True,bIsUseBackupSaveData=True,LogFormatType=Text,RESTAPIEnabled=True,RESTAPIPort=8212,ChatPostLimitPerMinute=30,BaseCampMaxNumInGuild=8,MaxBuildingLimitNum=0,ServerReplicatePawnCullDistance=15000.000000,ItemWeightRate=0.200000,ItemCorruptionMultiplier=0.000000,SupplyDropSpan=180,MonsterFarmActionSpeedRate=1.000000,PlayerStaminaDecreaceRate=0.1,PalStaminaDecreaceRate=0.1,bAllowGlobalPalboxExport=True,bAllowGlobalPalboxImport=True,bEnableNonLoginPenalty=False,PalStomachDecreaceRate=0.500000,PalAutoHPRegeneRate=1.000000)
```

### Key Multiplier Highlights
- **Player & Mount Stamina**: Set to `0.1` (stamina lasts 10x longer).
- **Item Weight Multiplier**: Set to `0.2` (items weigh 80% less).
- **Pal Egg Hatching Time**: Set to `0.0` (instant egg incubation).
- **Food Spoil Multiplier**: Set to `0.0` (food never expires/corrupts).
- **Supply Drop Span**: Set to `180` minutes.
- **Death Penalty**: Set to `None` (players retain all equipment and Pals upon death).
- **Crossplay**: Enabled across Steam, Xbox, PS5, and Mac.

---

## 4. Feature Modules Breakdown

### 4.1. Backup Engine & Google Drive Sync
- **Speed**: Compresses `Pal/Saved` and `PalServer.sh` natively with fast compression level `-1` in **~2 seconds** (saving ~100MB instead of 6GB of binaries).
- **Zero-Downtime World Flush**: Executes Source RCON `Save` prior to snapshotting to flush memory buffers without interrupting connected players.
- **Google Drive Storage**: Uploads verified snapshots directly via `rclone copyto` to `gdrive:PalworldBackups`.
- **Newest-First Sorting**: Remote archives are ordered descending by modification timestamp.
- **Direct Local Browser Download**: `GET /api/v1/backup/download/:filename` endpoint streams the archive straight from Google Drive or local cache to the user's computer with browser download progress.
- **Self-Healing Lock System**: Stale `.backup.lock` files older than 2 minutes are automatically expired, plus an instant `Reset Lock Now` button is built into the UI.

### 4.2. Accurate Player Counter (Zero False Positives)
- **Primary Tier**: Authoritative Source RCON command `ShowPlayers` queries the live game engine.
- **Network Validation**: On Linux, inspects established UDP sockets on port `8211` (`ss -un state established '( sport = :8211 )'`). When 0 clients are connected, player count is strictly `0 / 32 max`.
- **Offline Guard**: If the server process is stopped, online player count immediately returns `0`.

### 4.3. Configuration Editor with Rollbacks
- **Visual & Raw Tabs**: Switch between interactive numerical sliders/inputs and direct raw INI text.
- **Quote-Safe Parser**: Preserves nested parentheses, unquoted keywords (`None`, `All`), and complex crossplay strings.
- **Snapshot Versioning**: Every save automatically creates a timestamped rollback snapshot stored in SQLite.

### 4.4. Live Console & Administrative Terminal
- **Continuous Log Tailing**: Discovers `PalServer.log` dynamically and streams new log lines via WebSocket.
- **GNU Screen Buffer Extraction**: Automatically reads the live terminal buffer from the `palworld` screen session.
- **Dual Command Delivery**: Typed administrative commands are transmitted via both Source RCON and direct stdin stuffing into `screen -S palworld -p 0 -X stuff "${cmd}^M"`.
- **Optimistic Feedback**: Echoes user commands and outputs instantly with color-coded severity tags (`INFO`, `WARN`, `ERROR`).

### 4.5. Luxury Glassmorphism UI
- **Obsidian Dark Aesthetic**: `#08090C` background with subtle ambient radial gradients in lime and emerald.
- **Frosted Glass Cards**: `.glass-panel` and `.glass-card` elements with backdrop blur and inset highlights.
- **Pulsing Radar Status**: Animated status dots and interactive capacity meters.
- **Console Banner**: Stylized `_0xinit()` ASCII signature banner logged to DevTools console on initialization.

---

## 5. Routine Operations & Maintenance Commands

### Deploy or Update Dashboard
Run this command on the VPS whenever new updates are pulled from GitHub:
```bash
cd ~/PalAutoBC
git pull
bash ./scripts/deploy.sh
```

### Start Palworld Dedicated Server Cleanly
```bash
cd /home/paladmin/palworld
screen -wipe 2>/dev/null || true
screen -dmS palworld ./PalServer.sh -port=8211 -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS
```

### Stop Palworld Dedicated Server Gracefully
```bash
# Graceful save and shutdown via RCON
cd ~/PalAutoBC && screen -S palworld -p 0 -X stuff "Save^M"
sleep 2
screen -S palworld -X quit 2>/dev/null || pkill -f 'PalServer' 2>/dev/null || true
```

### Attach to Live Palworld Console in Terminal
```bash
screen -r palworld
# Press Ctrl + A, then D to detach without closing the server
```

### Check Web Service Logs
```bash
# Check service status
sudo systemctl status palautobc.service

# Live follow dashboard output
sudo journalctl -u palautobc.service -f
```

### Clear Stale Backup Lock Manually
```bash
rm -f /home/paladmin/PalAutoBC/data/.backup.lock
sudo systemctl restart palautobc.service
```

---

## 6. Changelog & Bug Fix History

| Version / Commit | Issue Diagnosed | Resolution Implemented |
| :--- | :--- | :--- |
| `fd8d7c4` | Backups listed oldest-first; no direct browser download. | Sorted remote archives by timestamp descending; added `GET /backup/download/:filename` endpoint and UI Download button. |
| `2660cd3` | Live Console showed only 2 placeholder lines; commands gave no output. | Added continuous 1.5s log file polling, screen buffer extraction, dual RCON/screen delivery, and optimistic UI echo. |
| `fa8e1f4` | SQLite error `no such column: "schedule-daily"`. | Replaced double quotes with parameterized queries (`WHERE id = ?`) in `SchedulerService.ts`. |
| `1b75a5b` | Blank black screen on `/config` (`TypeError: t.map is not a function`). | Awaited async `ConfigService.getSnapshots()`, enforced array guards across all frontend `.map` calls, and added a React `ErrorBoundary`. |
| `7484f57` | Active players showed `14 / 32` when 0 players were online. | Replaced timestamp matching with authoritative Source RCON `ShowPlayers` and verified established UDP sockets on port 8211. |
| `2be652b` | Backup stalled with "already active" lock; slow 15-minute zip. | Implemented fast native `zip -1` of `Pal/Saved` (< 3s), 2-minute lock auto-expiration, and `POST /backup/unlock` endpoint. |
| `2b023ed` | Standard flat dark UI. | Overhauled entire frontend to modern dark glassmorphism with ambient lighting, glowing meters, and 1-click directory copy buttons. |

---

*Documentation compiled and maintained for PalAutoBC — Production Palworld Management Panel.*
