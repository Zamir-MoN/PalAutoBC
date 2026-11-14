import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { config } from '../config/index.js';
import { BackupService } from '../modules/backup/backupService.js';
import { SchedulerService } from '../modules/scheduler/schedulerService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const execAsync = util.promisify(exec);
const router = Router();

router.use(authMiddleware);

router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  const history = await BackupService.getHistory();
  res.json(history);
});

router.get('/remote', async (req: AuthenticatedRequest, res: Response) => {
  const remoteBackups = await BackupService.listRemoteBackups();
  res.json(remoteBackups);
});

router.post('/unlock', (req: AuthenticatedRequest, res: Response) => {
  BackupService.clearLock();
  res.json({ success: true, message: 'Backup lock cleared.' });
});

router.post('/run', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BackupService.runBackup('manual');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:filename', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename } = req.params;
    if (!filename || !/^palbc_[a-zA-Z0-9_\-\.]+\.zip$/.test(filename)) {
      res.status(400).json({ error: 'Invalid backup filename.' });
      return;
    }

    if (!fs.existsSync(config.tempBackupDir)) {
      fs.mkdirSync(config.tempBackupDir, { recursive: true });
    }

    const tempLocalPath = path.join(config.tempBackupDir, filename);

    // If file is already locally on VPS in temporary-backups, serve immediately
    if (fs.existsSync(tempLocalPath)) {
      res.download(tempLocalPath, filename);
      return;
    }

    // Pull file from Google Drive via rclone
    const remoteDest = `${config.rcloneRemote}:${config.rcloneBackupFolder}`;
    const rcloneCmd = `rclone copyto "${remoteDest}/${filename}" "${tempLocalPath}"`;
    await execAsync(rcloneCmd);

    if (!fs.existsSync(tempLocalPath)) {
      res.status(404).json({ error: 'Backup archive not found on remote storage.' });
      return;
    }

    res.download(tempLocalPath, filename, () => {
      // Clean up temp file after download to save disk space
      try {
        if (fs.existsSync(tempLocalPath)) {
          fs.unlinkSync(tempLocalPath);
        }
      } catch {}
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Download failed.' });
  }
});

router.get('/scheduler', (req: AuthenticatedRequest, res: Response) => {
  try {
    const schedule = SchedulerService.getSchedule();
    res.json(schedule || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/scheduler', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { time, enabled, timezone } = req.body;
    const updated = SchedulerService.updateSchedule(time, enabled, timezone);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
