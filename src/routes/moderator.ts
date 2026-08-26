import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/authorize';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate, requireRole('moderator', 'admin'));

// Students
router.get('/students', requirePermission('view_students'), async (req: AuthRequest, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    let where = "WHERE role = 'student'";
    const params: any[] = [];
    if (search) {
      where += ' AND (name ILIKE $1 OR email ILIKE $1)';
      params.push(`%${search}%`);
    }
    const studentsResult = await query(
      `SELECT id, name, email, status, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );
    const countResult = await query(`SELECT COUNT(*) as count FROM users ${where}`, params);
    const total = Number(countResult.rows[0].count);
    
    return res.json({ students: studentsResult.rows, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
});

router.get('/students/:id', requirePermission('view_students'), async (req, res) => {
  try {
    const studentResult = await query(
      "SELECT id, name, email, status, created_at FROM users WHERE id = $1 AND role = 'student'",
      [req.params.id]
    );
    if (studentResult.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    return res.json(studentResult.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch student' });
  }
});

router.patch('/students/:id/status', requirePermission('manage_students'), async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await query('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
