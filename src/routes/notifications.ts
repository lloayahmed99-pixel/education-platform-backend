import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT * FROM notifications 
      WHERE user_id = $1 OR is_global = 1 
      ORDER BY created_at DESC LIMIT 50
    `, [req.user!.id]);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE id = $1 AND (user_id = $2 OR is_global = 1)', [req.params.id, req.user!.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

export default router;
