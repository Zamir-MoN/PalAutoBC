import { Router, Response } from 'express';
import { ConfigService } from '../modules/config/configService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await ConfigService.readSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to read settings' });
  }
});

router.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { settings, rawContent } = req.body;
    if (!settings && !rawContent) {
      res.status(400).json({ error: 'Settings object or rawContent string is required.' });
      return;
    }

    const result = await ConfigService.saveSettings(settings || {}, rawContent, req.user?.username || 'admin');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save settings' });
  }
});

router.get('/snapshots', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshots = await ConfigService.getSnapshots();
    res.json(Array.isArray(snapshots) ? snapshots : []);
  } catch (err: any) {
    res.json([]);
  }
});

router.post('/snapshots/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await ConfigService.restoreSnapshot(id);
    res.json({ success: true, message: 'Snapshot restored successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to restore snapshot' });
  }
});

export default router;
