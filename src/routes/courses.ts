import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission, requireRole } from '../middleware/authorize';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let sql = 'SELECT * FROM courses WHERE published = 1';
  const params: any[] = [];
  
  if (search) {
    sql += ' AND title ILIKE $1';
    params.push(`%${search}%`);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);
  
  try {
    const result = await query(sql, params);
    const courses = result.rows;

    let countSql = 'SELECT COUNT(*) as count FROM courses WHERE published = 1';
    const countParams: any[] = [];
    if (search) {
      countSql += ' AND title ILIKE $1';
      countParams.push(`%${search}%`);
    }
    const countResult = await query(countSql, countParams);
    
    // Check if user is enrolled
    if (req.user && req.user.role === 'student') {
      for (const course of courses) {
        const enrolled = await query('SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2', [req.user.id, course.id]);
        course.isEnrolled = enrolled.rows.length > 0;
      }
    }

    return res.json({
      data: courses,
      total: Number(countResult.rows[0].count),
      page: Number(page),
      totalPages: Math.ceil(Number(countResult.rows[0].count) / Number(limit))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
    const course = result.rows[0];
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const modulesResult = await query('SELECT * FROM modules WHERE course_id = $1 ORDER BY order_index ASC', [course.id]);
    const modules = modulesResult.rows;
    
    for (const mod of modules) {
      const videosResult = await query('SELECT id, title, duration_seconds, order_index FROM videos WHERE module_id = $1 ORDER BY order_index ASC', [mod.id]);
      mod.videos = videosResult.rows;
    }

    course.modules = modules;

    if (req.user && req.user.role === 'student') {
      const enrolled = await query('SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2', [req.user.id, course.id]);
      course.isEnrolled = enrolled.rows.length > 0;
    }

    return res.json(course);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch course details' });
  }
});

router.post('/:id/enroll', authenticate, requireRole('student'), async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.user!.id;
    
    const existing = await query('SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2', [studentId, courseId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already enrolled' });
    }

    await query(
      'INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2)',
      [studentId, courseId]
    );
    
    await query('UPDATE courses SET students_count = students_count + 1 WHERE id = $1', [courseId]);
    
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to enroll' });
  }
});

export default router;
