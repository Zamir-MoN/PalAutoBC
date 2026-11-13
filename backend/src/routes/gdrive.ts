import { Router, Response } from 'express';
import { exec } from 'child_process';
import util from 'util';
import { config } from '../config/index.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const execAsync = util.promisify(exec);
const router = Router();

router.use(authMiddleware);

router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  if (process.platform === 'win32') {
    res.json({
      connected: true,
      remote: config.rcloneRemote,
      backupFolder: config.rcloneBackupFolder,
      version: 'rclone v1.66.0 (simulated dev environment)',
    });
    return;
  }

  try {
    const { stdout: versionOut } = await execAsync('rclone version');
    const { stdout: remotesOut } = await execAsync('rclone listremotes');

    const remotes = remotesOut.split('\n').map((r) => r.trim().replace(':', '')).filter(Boolean);
    const hasRemote = remotes.includes(config.rcloneRemote);

    res.json({
      connected: hasRemote,
      remote: config.rcloneRemote,
      backupFolder: config.rcloneBackupFolder,
      availableRemotes: remotes,
      version: versionOut.split('\n')[0],
    });
  } catch (err: any) {
    res.json({
      connected: false,
      error: err.message,
      remote: config.rcloneRemote,
      backupFolder: config.rcloneBackupFolder,
    });
  }
});

export default router;

