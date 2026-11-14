import { Router, Response } from 'express';
import { ServerService } from '../modules/server/serverService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  const status = await ServerService.getStatus();
  res.json(status);
});

router.post('/start', async (req: AuthenticatedRequest, res: Response) => {
  const force = Boolean(req.body?.force);
  const result = await ServerService.start(force);
  res.json(result);
});

router.post('/stop', async (req: AuthenticatedRequest, res: Response) => {
  const result = await ServerService.stop();
  res.json(result);
});

router.post('/restart', async (req: AuthenticatedRequest, res: Response) => {
  const result = await ServerService.restart();
  res.json(result);
});

export default router;
