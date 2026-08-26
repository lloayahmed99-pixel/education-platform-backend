import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate, requireRole('admin'));

// ========== STUDENTS ==========

router.get('/students', async (req, res) => {
  const { page = 1, limit = 20, search = '', status = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let where = "WHERE role = 'student'";
  const params: any[] = [];
  
  if (search) {
    where += ' AND (name ILIKE $1 OR email ILIKE $1)';
    params.push(`%${search}%`);
  }
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  
  try {
    const studentsResult = await query(
      `SELECT id, name, email, profile_image, status, points, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );
    
    const countResult = await query(`SELECT COUNT(*) as count FROM users ${where}`, params);
    const total = Number(countResult.rows[0].count);
    
    return res.json({
      students: studentsResult.rows,
      total,
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
});

router.get('/students/:id', async (req, res) => {
  try {
    const studentResult = await query(
      "SELECT id, name, email, phone, parent_phone, profile_image, status, points, created_at FROM users WHERE id = $1 AND role = 'student'",
      [req.params.id]
    );
    const student = studentResult.rows[0];
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    const enrollmentsResult = await query(`
      SELECT e.*, c.title as course_title FROM enrollments e
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE e.student_id = $1
    `, [req.params.id]);
    
    const quizAttemptsResult = await query(
      'SELECT * FROM quiz_attempts WHERE student_id = $1 ORDER BY started_at DESC',
      [req.params.id]
    );
    
    const videoProgressResult = await query(`
      SELECT vp.*, v.title as video_title, c.title as course_title 
      FROM video_progress vp
      JOIN videos v ON vp.video_id = v.id
      JOIN courses c ON v.course_id = c.id
      WHERE vp.student_id = $1
      ORDER BY vp.last_watched_at DESC
    `, [req.params.id]);
    
    return res.json({ 
      ...student, 
      enrollments: enrollmentsResult.rows, 
      quizAttempts: quizAttemptsResult.rows,
      videoProgress: videoProgressResult.rows 
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch student' });
  }
});

router.post('/students', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const existingResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingResult.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });
    
    const hash = bcrypt.hashSync(password, 10);
    const result = await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'student') RETURNING id",
      [name, email, hash]
    );
    return res.status(201).json({ id: result.rows[0].id, name, email, role: 'student' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create student' });
  }
});

router.put('/students/:id', async (req, res) => {
  const { name, email } = req.body;
  try {
    await query('UPDATE users SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [name, email, req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update student' });
  }
});

router.patch('/students/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await query('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    await query("DELETE FROM users WHERE id = $1 AND role = 'student'", [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete student' });
  }
});

// ========== MODERATORS ==========

router.get('/moderators', async (req, res) => {
  try {
    const modsResult = await query(`
      SELECT m.id, m.user_id, m.status, m.created_at,
             u.name, u.email, u.profile_image
      FROM moderators m JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
    `);
    
    const mods = modsResult.rows;
    const modWithPerms = [];
    
    for (const mod of mods) {
      const permsResult = await query(`
        SELECT p.name FROM moderator_permissions mp
        JOIN permissions p ON mp.permission_id = p.id
        WHERE mp.moderator_id = $1
      `, [mod.id]);
      
      modWithPerms.push({
        ...mod,
        user: { name: mod.name, email: mod.email, profile_image: mod.profile_image },
        permissions: permsResult.rows.map(p => p.name),
      });
    }
    
    return res.json(modWithPerms);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch moderators' });
  }
});

router.post('/moderators', async (req: AuthRequest, res) => {
  const { name, email, password, permissions = [] } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });
    
    await query('BEGIN');
    const hash = bcrypt.hashSync(password, 10);
    const userResult = await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'moderator') RETURNING id",
      [name, email, hash]
    );
    const userId = userResult.rows[0].id;
    
    const modResult = await query(
      'INSERT INTO moderators (user_id, created_by) VALUES ($1, $2) RETURNING id',
      [userId, req.user!.id]
    );
    const modId = modResult.rows[0].id;
    
    for (const p of permissions as string[]) {
      const permResult = await query('SELECT id FROM permissions WHERE name = $1', [p]);
      if (permResult.rows.length > 0) {
        await query('INSERT INTO moderator_permissions (moderator_id, permission_id) VALUES ($1, $2)', [modId, permResult.rows[0].id]);
      }
    }
    await query('COMMIT');
    return res.status(201).json({ id: modId });
  } catch (err) {
    await query('ROLLBACK');
    return res.status(500).json({ error: 'Failed to create moderator' });
  }
});

router.put('/moderators/:id', async (req, res) => {
  const { status } = req.body;
  try {
    await query('UPDATE moderators SET status = $1 WHERE id = $2', [status, req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update moderator' });
  }
});

router.delete('/moderators/:id', async (req, res) => {
  try {
    const modResult = await query('SELECT user_id FROM moderators WHERE id = $1', [req.params.id]);
    if (modResult.rows.length === 0) return res.status(404).json({ error: 'Moderator not found' });
    
    await query('DELETE FROM users WHERE id = $1', [modResult.rows[0].user_id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete moderator' });
  }
});

router.get('/moderators/:id/permissions', async (req, res) => {
  try {
    const permsResult = await query(`
      SELECT p.name FROM moderator_permissions mp
      JOIN permissions p ON mp.permission_id = p.id
      WHERE mp.moderator_id = $1
    `, [req.params.id]);
    return res.json(permsResult.rows.map(p => p.name));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

router.put('/moderators/:id/permissions', async (req, res) => {
  const { permissions = [] } = req.body;
  try {
    await query('BEGIN');
    await query('DELETE FROM moderator_permissions WHERE moderator_id = $1', [req.params.id]);
    
    for (const p of permissions as string[]) {
      const permResult = await query('SELECT id FROM permissions WHERE name = $1', [p]);
      if (permResult.rows.length > 0) {
        await query('INSERT INTO moderator_permissions (moderator_id, permission_id) VALUES ($1, $2)', [req.params.id, permResult.rows[0].id]);
      }
    }
    await query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await query('ROLLBACK');
    return res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// ========== ENROLLMENTS ==========

router.get('/enrollments', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const enrollmentsResult = await query(`
      SELECT e.*, u.name as student_name, u.email as student_email, c.title as course_title
      FROM enrollments e
      LEFT JOIN users u ON e.student_id = u.id
      LEFT JOIN courses c ON e.course_id = c.id
      ORDER BY e.enrolled_at DESC LIMIT $1 OFFSET $2
    `, [Number(limit), offset]);
    
    const countResult = await query('SELECT COUNT(*) as count FROM enrollments');
    const total = Number(countResult.rows[0].count);
    
    return res.json({ enrollments: enrollmentsResult.rows, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

router.post('/enrollments', async (req, res) => {
  const { studentId, courseId } = req.body;
  try {
    await query('INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [studentId, courseId]);
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create enrollment' });
  }
});

router.delete('/enrollments/:id', async (req, res) => {
  try {
    await query('DELETE FROM enrollments WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete enrollment' });
  }
});

// ========== ACTIVITY LOGS ==========

router.get('/logs', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const logsResult = await query(`
      SELECT a.*, u.name as user_name, u.email as user_email
      FROM activity_logs a LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC LIMIT $1 OFFSET $2
    `, [Number(limit), offset]);
    
    const countResult = await query('SELECT COUNT(*) as count FROM activity_logs');
    const total = Number(countResult.rows[0].count);
    
    return res.json({ logs: logsResult.rows, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;
