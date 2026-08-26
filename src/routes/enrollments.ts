import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT e.*, c.title, c.thumbnail, c.instructor_id, u.name as instructor_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE e.student_id = $1
    `, [req.user!.id]);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

export default router;
