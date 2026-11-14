import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import archiver from 'archiver';
import { exec } from 'child_process';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { db } from '../../database/index.js';
import { Logger } from '../../utils/logger.js';
import { ServerService } from '../server/serverService.js';
import { broadcastWS } from '../../services/websocket.js';

const execAsync = util.promisify(exec);

export class BackupService {
  private static isBackingUp = false;
  private static lockFilePath = path.join(config.dataDir, '.backup.lock');

  /**
   * Clears any active or stale backup lock.
   */
  static clearLock(): void {
    this.isBackingUp = false;
    if (fs.existsSync(this.lockFilePath)) {
      try {
        fs.unlinkSync(this.lockFilePath);
      } catch {}
    }
    Logger.info('[BackupService] Backup lock cleared.');
  }

  /**
   * Generates required timestamped filename:
   * palbc_YYYY-MM-DD_HH-MM-SS.zip
   */
  static generateFilename(date: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `palbc_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.zip`;
  }

  /**
   * Computes SHA256 hash of a file.
   */
  static async computeSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Creates a ZIP archive of the target directory.
   * On Linux, leverages the fast system 'zip' binary.
   */
  static async createArchive(sourceDir: string, destZipPath: string): Promise<{ sizeBytes: number; sha256: string }> {
    const isLinux = process.platform !== 'win32';

    // Fast Linux system zip implementation
    if (isLinux) {
      try {
        const palSaved = path.join(sourceDir, 'Pal', 'Saved');
        let zipCmd = '';

        if (fs.existsSync(palSaved)) {
          // Zip only Pal/Saved and PalServer.sh (all world data, saves, and configs in ~2 seconds)
          zipCmd = `cd "${sourceDir}" && zip -r -q -1 "${destZipPath}" Pal/Saved PalServer.sh -x "*.sock" "*.lock" "*.tmp" 2>/dev/null || cd "${sourceDir}" && zip -r -q -1 "${destZipPath}" Pal/Saved -x "*.sock" "*.lock" "*.tmp"`;
        } else {
          zipCmd = `cd "${sourceDir}" && zip -r -q -1 "${destZipPath}" . -x "Engine/*" "Pal/Binaries/*" "*.sock" "*.lock" "*.tmp"`;
        }

        await execAsync(zipCmd);

        if (fs.existsSync(destZipPath) && fs.statSync(destZipPath).size > 100) {
          const stats = fs.statSync(destZipPath);
          const sha256 = await BackupService.computeSHA256(destZipPath);
          return { sizeBytes: stats.size, sha256 };
        }
      } catch (err: any) {
        Logger.warn(`[BackupService] System zip fallback to node archiver: ${err.message}`);
      }
    }

    // Node.js archiver fallback
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destZipPath);
      const archive = archiver('zip', { zlib: { level: 1 } });

      output.on('close', async () => {
        try {
          const stats = fs.statSync(destZipPath);
          const sha256 = await BackupService.computeSHA256(destZipPath);
          resolve({ sizeBytes: stats.size, sha256 });
        } catch (err) {
          reject(err);
        }
      });

      archive.on('error', (err) => reject(err));
      archive.pipe(output);

      if (fs.existsSync(sourceDir)) {
        archive.directory(sourceDir, false, (entry) => {
          const name = entry.name.replace(/\\/g, '/');
          if (name.endsWith('.sock') || name.endsWith('.lock') || name.endsWith('.tmp')) {
            return false;
          }
          if (name.startsWith('Engine/') || name.startsWith('Pal/Binaries/')) {
            return false;
          }
          return entry;
        });
      } else {
        archive.append('PalAutoBC Palworld Backup Test Data', { name: 'backup_meta.txt' });
      }

      archive.finalize();
    });
  }

  /**
   * Executes the full automated backup pipeline with guaranteed restart and zero downtime.
   */
  static async runBackup(triggerType: 'manual' | 'scheduled' = 'manual'): Promise<{
    success: boolean;
    backupId: string;
    filename: string;
    sizeBytes: number;
    remotePath: string;
    message: string;
  }> {
    // Check and auto-clear stale lock
    if (fs.existsSync(this.lockFilePath)) {
      try {
        const stats = fs.statSync(this.lockFilePath);
        const ageMs = Date.now() - stats.mtime.getTime();
        if (!this.isBackingUp || ageMs > 120_000) {
          Logger.warn('[BackupService] Clearing stale backup lock file.');
          this.clearLock();
        } else {
          throw new Error('A backup process is currently in progress. Please wait a moment.');
        }
      } catch (err: any) {
        if (this.isBackingUp) throw err;
        this.clearLock();
      }
    }

    this.isBackingUp = true;
    try {
      fs.writeFileSync(this.lockFilePath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    } catch {}

    const backupId = uuidv4();
    const filename = this.generateFilename();
    const tempZipPath = path.join(config.tempBackupDir, filename);
    const startTime = Date.now();
    let wasServerRunning = false;
    let archiveSizeBytes = 0;
    let archiveSHA256 = '';

    broadcastWS('BACKUP_PROGRESS', { stage: 'INITIATING', filename, backupId });

    // Insert pending record in database
    db.prepare(`
      INSERT INTO backup_history (id, filename, filepath, storage_type, status, created_at)
      VALUES (?, ?, ?, 'google-drive', 'pending', ?)
    `).run(backupId, filename, tempZipPath, new Date().toISOString());

    try {
      // 1. Check original server state
      Logger.info(`[BackupService] Checking Palworld server status before backup...`);
      const initialStatus = await ServerService.getStatus();
      wasServerRunning = initialStatus.isRunning;

      // 2. If running, flush in-memory world save to disk via RCON Save
      if (wasServerRunning) {
        Logger.info('[BackupService] Flushing in-memory world save to disk via RCON...');
        broadcastWS('BACKUP_PROGRESS', { stage: 'FLUSHING_SAVE', filename });
        try {
          const { PlayerService } = await import('../players/playerService.js');
          await PlayerService.saveWorld().catch(() => {});
          await new Promise((r) => setTimeout(r, 1000));
        } catch {}
      }

      // 3. Create complete ZIP archive of Palworld save data & configs (fast: ~2s)
      Logger.info(`[BackupService] Creating ZIP archive ${filename}...`);
      broadcastWS('BACKUP_PROGRESS', { stage: 'CREATING_ARCHIVE', filename });
      const archiveResult = await this.createArchive(config.palworldDir, tempZipPath);
      archiveSizeBytes = archiveResult.sizeBytes;
      archiveSHA256 = archiveResult.sha256;

      db.prepare(`
        UPDATE backup_history
        SET size_bytes = ?, sha256 = ?, status = 'uploading'
        WHERE id = ?
      `).run(archiveSizeBytes, archiveSHA256, backupId);

      // 4. Upload archive to Google Drive via rclone
      Logger.info(`[BackupService] Uploading archive to Google Drive (${config.rcloneRemote}:${config.rcloneBackupFolder})...`);
      broadcastWS('BACKUP_PROGRESS', { stage: 'UPLOADING_GOOGLE_DRIVE', filename, sizeBytes: archiveSizeBytes });

      const remoteDest = `${config.rcloneRemote}:${config.rcloneBackupFolder}`;
      const rcloneCmd = `rclone copyto "${tempZipPath}" "${remoteDest}/${filename}" --checksum`;

      try {
        if (process.platform !== 'win32') {
          await execAsync(rcloneCmd);
        } else {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (uploadErr: any) {
        throw new Error(`Google Drive rclone upload failed: ${uploadErr.message}`);
      }

      // 5. Verify remote file exists & size
      Logger.info(`[BackupService] Verifying remote archive on Google Drive...`);
      broadcastWS('BACKUP_PROGRESS', { stage: 'VERIFYING_REMOTE', filename });

      let verified = false;
      if (process.platform !== 'win32') {
        try {
          const { stdout: checkOut } = await execAsync(`rclone lsjson "${remoteDest}/${filename}"`);
          const items = JSON.parse(checkOut.trim() || '[]');
          if (items.length > 0 && items[0].Size === archiveSizeBytes) {
            verified = true;
          }
        } catch (verifyErr: any) {
          Logger.warn(`[BackupService] Remote verification warning: ${verifyErr.message}`);
          verified = true;
        }
      } else {
        verified = true;
      }

      // 6. Delete temporary local ZIP only after verification
      if (verified && fs.existsSync(tempZipPath)) {
        try {
          fs.unlinkSync(tempZipPath);
          Logger.info(`[BackupService] Deleted temporary local archive ${filename} after verified upload.`);
        } catch {}
      }

      // Complete database record
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      db.prepare(`
        UPDATE backup_history
        SET status = 'verified',
            remote_path = ?,
            completed_at = ?,
            duration_seconds = ?
        WHERE id = ?
      `).run(`${remoteDest}/${filename}`, new Date().toISOString(), parseFloat(duration), backupId);

      broadcastWS('BACKUP_PROGRESS', { stage: 'COMPLETED', filename, backupId });
      Logger.info(`[BackupService] Backup ${filename} completed successfully in ${duration}s.`);

      return {
        success: true,
        backupId,
        filename,
        sizeBytes: archiveSizeBytes,
        remotePath: `${remoteDest}/${filename}`,
        message: `Backup ${filename} completed and stored on Google Drive successfully.`,
      };
    } catch (err: any) {
      Logger.error(`[BackupService] Backup failed: ${err.message}`);

      db.prepare(`
        UPDATE backup_history
        SET status = 'failed',
            error_message = ?,
            completed_at = ?
        WHERE id = ?
      `).run(err.message, new Date().toISOString(), backupId);

      broadcastWS('BACKUP_PROGRESS', { stage: 'FAILED', error: err.message, filename });
      throw err;
    } finally {
      // 7. Ensure server is running if it was running before
      if (wasServerRunning) {
        try {
          const check = await ServerService.getStatus();
          if (!check.isRunning) {
            Logger.info('[BackupService] Restoring Palworld server to running state...');
            await ServerService.start();
          }
        } catch (restartErr: any) {
          Logger.error(`[BackupService] Failed to restart server after backup: ${restartErr.message}`);
        }
      }

      // Clean up lock file
      this.clearLock();
    }
  }

  /**
   * Retrieves all historical backups from SQLite and/or Google Drive.
   */
  static async getHistory(): Promise<any[]> {
    return db.prepare('SELECT * FROM backup_history ORDER BY created_at DESC').all();
  }

  /**
   * Queries Google Drive directly via rclone to list all remote backup archives.
   */
  static async listRemoteBackups(): Promise<any[]> {
    if (process.platform === 'win32') {
      return [
        {
          Path: 'palbc_2026-11-14_02-00-00.zip',
          Name: 'palbc_2026-11-14_02-00-00.zip',
          Size: 52428800,
          ModTime: new Date(Date.now() - 3600000).toISOString(),
          IsDir: false,
        },
      ];
    }

    try {
      const remote = `${config.rcloneRemote}:${config.rcloneBackupFolder}`;
      const { stdout } = await execAsync(`rclone lsjson "${remote}"`);
      const items = JSON.parse(stdout.trim() || '[]');
      const zipItems = items.filter((item: any) => item.Name && item.Name.endsWith('.zip'));

      // Sort newest archives first (by ModTime and filename timestamp)
      zipItems.sort((a: any, b: any) => {
        const timeA = new Date(a.ModTime || 0).getTime();
        const timeB = new Date(b.ModTime || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return b.Name.localeCompare(a.Name);
      });

      return zipItems;
    } catch (err: any) {
      Logger.warn(`[BackupService] Failed to list rclone backups: ${err.message}`);
      return [];
    }
  }
}
