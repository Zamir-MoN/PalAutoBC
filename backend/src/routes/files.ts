import { Router, Response } from 'express';
import { FileService } from '../modules/files/fileService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/list', (req: AuthenticatedRequest, res: Response) => {
  const pathQuery = (req.query.path as string) || '';
  try {
    const items = FileService.listDirectory(pathQuery);
    res.json(items);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

router.get('/read', (req: AuthenticatedRequest, res: Response) => {
  const pathQuery = req.query.path as string;
  if (!pathQuery) {
    res.status(400).json({ error: 'File path is required.' });
    return;
  }
  try {
    const content = FileService.readFileContent(pathQuery);
    res.json({ content });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/write', (req: AuthenticatedRequest, res: Response) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    res.status(400).json({ error: 'Path and content are required.' });
    return;
  }
  try {
    FileService.writeFileContent(filePath, content);
    res.json({ success: true, message: 'File saved successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/rename', (req: AuthenticatedRequest, res: Response) => {
  const { path: filePath, newName } = req.body;
  if (!filePath || !newName) {
    res.status(400).json({ error: 'Path and newName are required.' });
    return;
  }
  try {
    FileService.rename(filePath, newName);
    res.json({ success: true, message: 'Renamed successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/delete', (req: AuthenticatedRequest, res: Response) => {
  const { path: filePath } = req.body;
  if (!filePath) {
    res.status(400).json({ error: 'Path is required.' });
    return;
  }
  try {
    FileService.delete(filePath);
    res.json({ success: true, message: 'Deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

