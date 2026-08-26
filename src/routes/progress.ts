import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/latest', async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT vp.*, v.title as video_title, c.id as course_id, c.title as course_title 
      FROM video_progress vp
      JOIN videos v ON vp.video_id = v.id
      JOIN courses c ON v.course_id = c.id
      WHERE vp.student_id = $1
      ORDER BY vp.last_watched_at DESC LIMIT 1
    `, [req.user!.id]);
    return res.json(result.rows[0] || null);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

router.get('/:videoId', async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM video_progress WHERE student_id = $1 AND video_id = $2', [req.user!.id, req.params.videoId]);
    return res.json(result.rows[0] || null);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

router.post('/:videoId', async (req: AuthRequest, res) => {
  const { currentPosition, duration, completed } = req.body;
  const completionPercentage = duration > 0 ? (currentPosition / duration) * 100 : 0;
  
  try {
    const existing = await query('SELECT id FROM video_progress WHERE student_id = $1 AND video_id = $2', [req.user!.id, req.params.videoId]);
    
    if (existing.rows.length > 0) {
      await query(`
        UPDATE video_progress 
        SET current_position = $1, duration = $2, completion_percentage = $3, completed = GREATEST(completed, $4), last_watched_at = CURRENT_TIMESTAMP 
        WHERE student_id = $5 AND video_id = $6
      `, [currentPosition, duration, completionPercentage, completed ? 1 : 0, req.user!.id, req.params.videoId]);
    } else {
      await query(`
        INSERT INTO video_progress (student_id, video_id, current_position, duration, completion_percentage, completed) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [req.user!.id, req.params.videoId, currentPosition, duration, completionPercentage, completed ? 1 : 0]);
    }
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update progress' });
  }
});

export default router;
