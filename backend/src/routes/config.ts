import { Router, Response } from 'express';
import { ConfigService } from '../modules/config/configService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  const settings = await ConfigService.readSettings();
  res.json(settings);
});

router.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    res.status(400).json({ error: 'Settings object is required.' });
    return;
  }

  const result = await ConfigService.saveSettings(settings, req.user?.username || 'admin');
  res.json(result);
});

router.get('/snapshots', (req: AuthenticatedRequest, res: Response) => {
  const snapshots = ConfigService.getSnapshots();
  res.json(snapshots);
});

router.post('/snapshots/:id/restore', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const result = ConfigService.restoreSnapshot(id);
  res.json(result);
});

export default router;

