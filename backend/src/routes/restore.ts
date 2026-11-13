import { Router, Response } from 'express';
import { RestoreService } from '../modules/restore/restoreService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  const history = await RestoreService.getHistory();
  res.json(history);
});

router.post('/execute', async (req: AuthenticatedRequest, res: Response) => {
  const { filename } = req.body;
  if (!filename) {
    res.status(400).json({ error: 'Filename is required for restore operation.' });
    return;
  }

  try {
    const result = await RestoreService.restoreBackup(filename);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

