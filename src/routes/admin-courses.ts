import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { query } from '../database/db';

const router = Router();
router.use(authenticate, requireRole('admin'));

// ========== COURSES CRUD ==========

router.get('/', async (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let sql = 'SELECT * FROM courses';
  const params: any[] = [];
  
  if (search) {
    sql += ' WHERE title ILIKE $1';
    params.push(`%${search}%`);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);
  
  try {
    const result = await query(sql, params);
    
    let countSql = 'SELECT COUNT(*) as count FROM courses';
    const countParams: any[] = [];
    if (search) {
      countSql += ' WHERE title ILIKE $1';
      countParams.push(`%${search}%`);
    }
    const countResult = await query(countSql, countParams);
    
    return res.json({
      courses: result.rows,
      total: Number(countResult.rows[0].count),
      pages: Math.ceil(Number(countResult.rows[0].count) / Number(limit))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

router.post('/', async (req, res) => {
  const { title, description, thumbnail, price, duration_hours } = req.body;
  try {
    const result = await query(
      'INSERT INTO courses (title, description, thumbnail, price, duration_hours, published, instructor_id) VALUES ($1, $2, $3, $4, $5, 0, $6) RETURNING *',
      [title, description, thumbnail, price, duration_hours, req.user!.id]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/:id', async (req, res) => {
  const { title, description, thumbnail, price, duration_hours, published } = req.body;
  
  try {
    const fields = [];
    const params = [];
    let queryStr = 'UPDATE courses SET updated_at = CURRENT_TIMESTAMP';
    
    if (title !== undefined) { params.push(title); fields.push(`title = $${params.length}`); }
    if (description !== undefined) { params.push(description); fields.push(`description = $${params.length}`); }
    if (thumbnail !== undefined) { params.push(thumbnail); fields.push(`thumbnail = $${params.length}`); }
    if (price !== undefined) { params.push(price); fields.push(`price = $${params.length}`); }
    if (duration_hours !== undefined) { params.push(duration_hours); fields.push(`duration_hours = $${params.length}`); }
    if (published !== undefined) { params.push(published ? 1 : 0); fields.push(`published = $${params.length}`); }
    
    if (fields.length > 0) {
      queryStr += ', ' + fields.join(', ') + ` WHERE id = $${params.length + 1} RETURNING *`;
      params.push(req.params.id);
      const result = await query(queryStr, params);
      return res.json(result.rows[0]);
    }
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete course' });
  }
});

// ========== MODULES CRUD ==========

router.post('/:courseId/modules', async (req, res) => {
  const { title, order_index } = req.body;
  try {
    const result = await query(
      'INSERT INTO modules (course_id, title, order_index) VALUES ($1, $2, $3) RETURNING *',
      [req.params.courseId, title, order_index || 0]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create module' });
  }
});

router.put('/:courseId/modules/:moduleId', async (req, res) => {
  const { title, order_index } = req.body;
  try {
    const result = await query(
      'UPDATE modules SET title = COALESCE($1, title), order_index = COALESCE($2, order_index) WHERE id = $3 AND course_id = $4 RETURNING *',
      [title, order_index, req.params.moduleId, req.params.courseId]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update module' });
  }
});

router.delete('/:courseId/modules/:moduleId', async (req, res) => {
  try {
    await query('DELETE FROM modules WHERE id = $1 AND course_id = $2', [req.params.moduleId, req.params.courseId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete module' });
  }
});

// ========== VIDEOS CRUD ==========

router.post('/:courseId/modules/:moduleId/videos', async (req, res) => {
  const { title, description, url, thumbnail, duration_seconds, order_index } = req.body;
  try {
    const result = await query(
      'INSERT INTO videos (course_id, module_id, title, description, url, thumbnail, duration_seconds, order_index) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.params.courseId, req.params.moduleId, title, description, url, thumbnail, duration_seconds || 0, order_index || 0]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create video' });
  }
});

router.put('/:courseId/modules/:moduleId/videos/:videoId', async (req, res) => {
  const { title, description, url, thumbnail, duration_seconds, order_index } = req.body;
  try {
    const result = await query(
      `UPDATE videos SET 
        title = COALESCE($1, title), 
        description = COALESCE($2, description),
        url = COALESCE($3, url),
        thumbnail = COALESCE($4, thumbnail),
        duration_seconds = COALESCE($5, duration_seconds),
        order_index = COALESCE($6, order_index),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND module_id = $8 AND course_id = $9 RETURNING *`,
      [title, description, url, thumbnail, duration_seconds, order_index, req.params.videoId, req.params.moduleId, req.params.courseId]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update video' });
  }
});

router.delete('/:courseId/modules/:moduleId/videos/:videoId', async (req, res) => {
  try {
    await query('DELETE FROM videos WHERE id = $1 AND module_id = $2 AND course_id = $3', [req.params.videoId, req.params.moduleId, req.params.courseId]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete video' });
  }
});

export default router;
