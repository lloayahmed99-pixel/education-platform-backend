import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
    const video = result.rows[0];
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check if enrolled
    if (req.user!.role === 'student') {
      const enrolled = await query('SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2', [req.user!.id, video.course_id]);
      if (enrolled.rows.length === 0) {
        return res.status(403).json({ error: 'Not enrolled in this course' });
      }
    }

    return res.json(video);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch video' });
  }
});

export default router;
