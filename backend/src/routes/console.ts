import { Router, Response } from 'express';
import { ConsoleService } from '../modules/console/consoleService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const logs = ConsoleService.getRecentLogs(limit);
  res.json(logs);
});

router.post('/command', async (req: AuthenticatedRequest, res: Response) => {
  const { command } = req.body;
  if (!command) {
    res.status(400).json({ error: 'Command cannot be empty.' });
    return;
  }
  const output = await ConsoleService.executeCommand(command);
  res.json({ output });
});

export default router;

