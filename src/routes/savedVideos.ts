import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const saved = await query(`
      SELECT sv.id as saved_id, sv.saved_at, v.*, c.title as course_title
      FROM saved_videos sv
      JOIN videos v ON sv.video_id = v.id
      JOIN courses c ON v.course_id = c.id
      WHERE sv.student_id = $1
      ORDER BY sv.saved_at DESC
    `, [req.user!.id]);
    return res.json(saved.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch saved videos' });
  }
});

router.post('/:videoId', async (req: AuthRequest, res) => {
  try {
    await query('INSERT INTO saved_videos (student_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user!.id, req.params.videoId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save video' });
  }
});

router.delete('/:videoId', async (req: AuthRequest, res) => {
  try {
    await query('DELETE FROM saved_videos WHERE student_id = $1 AND video_id = $2', [req.user!.id, req.params.videoId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to remove saved video' });
  }
});

export default router;
