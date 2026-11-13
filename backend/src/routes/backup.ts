import { Router, Response } from 'express';
import { BackupService } from '../modules/backup/backupService.js';
import { SchedulerService } from '../modules/scheduler/schedulerService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

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

router.get('/scheduler', (req: AuthenticatedRequest, res: Response) => {
  const schedule = SchedulerService.getSchedule();
  res.json(schedule);
});

router.put('/scheduler', (req: AuthenticatedRequest, res: Response) => {
  const { time, enabled, timezone } = req.body;
  const updated = SchedulerService.updateSchedule(time, enabled, timezone);
  res.json(updated);
});

export default router;

