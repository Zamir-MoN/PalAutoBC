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
  const { settings, rawContent } = req.body;
  if (!settings && !rawContent) {
    res.status(400).json({ error: 'Settings object or rawContent string is required.' });
    return;
  }

  const result = await ConfigService.saveSettings(settings || {}, rawContent, req.user?.username || 'admin');
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

