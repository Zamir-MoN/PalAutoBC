import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const ROOT_DIR = path.resolve(process.cwd());

function resolvePalworldDir(): string {
  if (process.env.PALWORLD_DIR && fs.existsSync(process.env.PALWORLD_DIR)) {
    return process.env.PALWORLD_DIR;
  }

  // Common user locations on Ubuntu VPS (paladmin, steam, ubuntu)
  const candidates = [
    '/home/paladmin/palworld',
    '/home/paladmin/Palserver',
    '/home/paladmin/Steam/steamapps/common/PalServer',
    '/home/paladmin',
    '/home/steam/palworld',
    '/home/steam/Steam/steamapps/common/PalServer',
    '/home/steam/Palserver',
    '/home/ubuntu/palworld',
    '/home/ubuntu/Palserver',
    '/home/ubuntu/Steam/steamapps/common/PalServer',
    path.join(process.env.HOME || '', 'palworld'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir) && (fs.existsSync(path.join(dir, 'PalServer.sh')) || fs.existsSync(path.join(dir, 'Pal')))) {
      return dir;
    }
  }

  return process.env.PALWORLD_DIR || '/home/ubuntu/Palserver';
}

export const config = {
  env: process.env.NODE_ENV || 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // Palworld Server Settings (auto-detected across paladmin, steam, ubuntu)
  palworldDir: resolvePalworldDir(),
  palworldExecutable: process.env.PALWORLD_EXEC || './PalServer.sh',
  palworldPort: parseInt(process.env.PALWORLD_PORT || '8211', 10),
  screenSessionName: process.env.SCREEN_SESSION || 'palworld',
  systemdServiceName: process.env.SYSTEMD_SERVICE || 'palworld.service',
  rconPort: parseInt(process.env.RCON_PORT || '25575', 10),
  rconPassword: process.env.RCON_PASSWORD || '',

  // Paths
  dataDir: path.join(ROOT_DIR, 'data'),
  dbPath: process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'database', 'palautobc.sqlite'),
  logsDir: path.join(ROOT_DIR, 'data', 'logs'),
  tempBackupDir: path.join(ROOT_DIR, 'data', 'temporary-backups'),
  stagingDir: path.join(ROOT_DIR, 'data', 'staging'),
  publicDir: path.join(ROOT_DIR, 'public'),

  // rclone Google Drive Settings
  rcloneRemote: process.env.RCLONE_REMOTE || 'gdrive',
  rcloneBackupFolder: process.env.RCLONE_BACKUP_FOLDER || 'PalworldBackups',

  // Security
  jwtSecret: process.env.JWT_SECRET || 'palautobc-super-secure-production-jwt-secret-key-2026',
  jwtExpiresIn: '7d',
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USER || 'admin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'PalAutoAdmin2026!',

  // Backups
  backupCron: process.env.BACKUP_CRON || '0 3 * * *', // Daily at 3:00 AM
  backupTimezone: process.env.BACKUP_TIMEZONE || 'UTC',
};

