import { Router, Response } from 'express';
import { PlayerService } from '../modules/players/playerService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/online', async (req: AuthenticatedRequest, res: Response) => {
  const players = await PlayerService.getOnlinePlayers();
  res.json({ count: players.length, players });
});

router.post('/kick', async (req: AuthenticatedRequest, res: Response) => {
  const { steamId } = req.body;
  if (!steamId) {
    res.status(400).json({ error: 'Steam ID is required.' });
    return;
  }
  const result = await PlayerService.kickPlayer(steamId);
  res.json({ success: true, message: result || 'Kick command executed.' });
});

router.post('/ban', async (req: AuthenticatedRequest, res: Response) => {
  const { steamId } = req.body;
  if (!steamId) {
    res.status(400).json({ error: 'Steam ID is required.' });
    return;
  }
  const result = await PlayerService.banPlayer(steamId);
  res.json({ success: true, message: result || 'Ban command executed.' });
});

router.post('/broadcast', async (req: AuthenticatedRequest, res: Response) => {
  const { message } = req.body;
  if (!message) {
    res.status(400).json({ error: 'Broadcast message cannot be empty.' });
    return;
  }
  const result = await PlayerService.broadcastMessage(message);
  res.json({ success: true, message: result || 'Broadcast sent.' });
});

router.post('/save', async (req: AuthenticatedRequest, res: Response) => {
  const result = await PlayerService.saveWorld();
  res.json({ success: true, message: result || 'World saved successfully.' });
});

export default router;

