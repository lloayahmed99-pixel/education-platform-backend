import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/authorize';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();

router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, profile_image, points, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  const { name, profile_image } = req.body;
  try {
    await query(
      'UPDATE users SET name = COALESCE($1, name), profile_image = COALESCE($2, profile_image), updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [name, profile_image, req.user!.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
