import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { query } from '../database/db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const settingsResult = await query("SELECT key, value FROM platform_settings");
    const result = settingsResult.rows.reduce((acc: any, s: any) => ({ ...acc, [s.key]: s.value }), {});
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', authenticate, requireRole('admin'), async (req, res) => {
  const settings = req.body;
  try {
    await query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      await query(
        "INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $3",
        [key, String(value), String(value)]
      );
    }
    await query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await query('ROLLBACK');
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
