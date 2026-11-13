
import { Router, Response } from 'express';
import { MonitoringService } from '../modules/monitoring/monitoringService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/metrics', async (req: AuthenticatedRequest, res: Response) => {
  const metrics = MonitoringService.getLatestMetrics() || (await MonitoringService.collectMetrics());
  res.json(metrics);
});

export default router;

