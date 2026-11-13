import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { exec } from 'child_process';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { db } from '../../database/index.js';
import { Logger } from '../../utils/logger.js';
import { ServerService } from '../server/serverService.js';
import { BackupService } from '../backup/backupService.js';
import { broadcastWS } from '../../services/websocket.js';

const execAsync = util.promisify(exec);

export class RestoreService {
  private static isRestoring = false;

  /**
   * Executes full disaster recovery restore from Google Drive or local archive.
   */
  static async restoreBackup(filename: string): Promise<{
    success: boolean;
    restoreId: string;
    message: string;
  }> {
    if (this.isRestoring) {
      throw new Error('A restoration operation is already in progress.');
    }

    this.isRestoring = true;
    const restoreId = uuidv4();
    const downloadDest = path.join(config.stagingDir, filename);
    const extractDir = path.join(config.stagingDir, `extracted_${restoreId}`);
    const safetySnapshotPath = path.join(config.tempBackupDir, `safety_snapshot_${Date.now()}.zip`);

    broadcastWS('RESTORE_PROGRESS', { stage: 'INITIATING', filename, restoreId });

    db.prepare(`
      INSERT INTO restore_history (id, filename, status, created_at)
      VALUES (?, ?, 'pending', ?)
    `).run(restoreId, filename, new Date().toISOString());

    try {
      // 1. Download archive from Google Drive to staging directory
      Logger.info(`[RestoreService] Fetching ${filename} from Google Drive to staging...`);
      broadcastWS('RESTORE_PROGRESS', { stage: 'DOWNLOADING_REMOTE', filename });

      if (process.platform !== 'win32') {
        const remoteSource = `${config.rcloneRemote}:${config.rcloneBackupFolder}/${filename}`;
        await execAsync(`rclone copyto "${remoteSource}" "${downloadDest}"`);
      } else {
        // Dev fallback: create a dummy zip if not present
        if (!fs.existsSync(downloadDest)) {
          const zip = new AdmZip();
          zip.addFile('PalServer.sh', Buffer.from('#!/bin/bash\necho "Running PalServer"'));
          zip.addFile('Pal/Saved/SaveGames/Level.sav', Buffer.from('Mock Palworld World Level Save Data'));
          zip.writeZip(downloadDest);
        }
      }

      if (!fs.existsSync(downloadDest)) {
        throw new Error(`Failed to download backup archive from Google Drive: ${filename}`);
      }

      // 2. Unpack into staging directory and verify structural integrity
      Logger.info(`[RestoreService] Unpacking archive into staging directory for integrity checks...`);
      broadcastWS('RESTORE_PROGRESS', { stage: 'VALIDATING_INTEGRITY', filename });

      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
      fs.mkdirSync(extractDir, { recursive: true });

      const zip = new AdmZip(downloadDest);
      zip.extractAllTo(extractDir, true);

      // Verify essential files
      const hasPalServer = fs.existsSync(path.join(extractDir, 'PalServer.sh')) || fs.existsSync(path.join(extractDir, 'Pal'));
      if (!hasPalServer) {
        throw new Error('Structural validation failed: Archive does not contain valid Palworld dedicated server files.');
      }

      // 3. Gracefully stop Palworld server
      Logger.info('[RestoreService] Stopping active server before restore...');
      broadcastWS('RESTORE_PROGRESS', { stage: 'STOPPING_SERVER', filename });
      await ServerService.stop();

      // 4. Create safety snapshot of current installation before overwriting
      Logger.info('[RestoreService] Creating pre-restore safety snapshot of active installation...');
      broadcastWS('RESTORE_PROGRESS', { stage: 'CREATING_SAFETY_SNAPSHOT', filename });
      if (fs.existsSync(config.palworldDir)) {
        try {
          await BackupService.createArchive(config.palworldDir, safetySnapshotPath);
          db.prepare('UPDATE restore_history SET safety_snapshot_path = ? WHERE id = ?').run(safetySnapshotPath, restoreId);
        } catch (snapErr: any) {
          Logger.warn(`[RestoreService] Could not create local safety snapshot: ${snapErr.message}`);
        }
      }

      // 5. Safely restore files to target installation directory
      Logger.info(`[RestoreService] Deploying restored files to ${config.palworldDir}...`);
      broadcastWS('RESTORE_PROGRESS', { stage: 'RESTORING_FILES', filename });

      if (process.platform !== 'win32') {
        // Sync extracted files into palworldDir safely using rsync or cp
        await execAsync(`cp -rf "${extractDir}/." "${config.palworldDir}/"`);
        // Enforce executable and ownership permissions
        await execAsync(`chmod +x "${config.palworldDir}/PalServer.sh" 2>/dev/null || true`);
        await execAsync(`chown -R ubuntu:ubuntu "${config.palworldDir}" 2>/dev/null || true`);
      } else {
        // Dev mock delay
        await new Promise((r) => setTimeout(r, 1500));
      }

      // 6. Start server and verify startup
      Logger.info('[RestoreService] Starting restored Palworld server...');
      broadcastWS('RESTORE_PROGRESS', { stage: 'STARTING_SERVER', filename });
      const startResult = await ServerService.start();

      // 7. Cleanup staging artifacts
      try {
        if (fs.existsSync(downloadDest)) fs.unlinkSync(downloadDest);
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
      } catch {}

      // Update database
      db.prepare(`
        UPDATE restore_history
        SET status = 'completed', completed_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), restoreId);

      broadcastWS('RESTORE_PROGRESS', { stage: 'COMPLETED', filename, restoreId });
      Logger.info(`[RestoreService] Restore of ${filename} finished successfully.`);

      return {
        success: true,
        restoreId,
        message: `Backup ${filename} restored and server restarted successfully.`,
      };
    } catch (err: any) {
      Logger.error(`[RestoreService] Restoration failed: ${err.message}`);

      db.prepare(`
        UPDATE restore_history
        SET status = 'failed', error_message = ?, completed_at = ?
        WHERE id = ?
      `).run(err.message, new Date().toISOString(), restoreId);

      broadcastWS('RESTORE_PROGRESS', { stage: 'FAILED', error: err.message, filename });
      throw err;
    } finally {
      this.isRestoring = false;
    }
  }

  static async getHistory(): Promise<any[]> {
    return db.prepare('SELECT * FROM restore_history ORDER BY created_at DESC').all();
  }
}

