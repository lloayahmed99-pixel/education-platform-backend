import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/posts', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const postsResult = await query(`
      SELECT p.*, u.name as author_name, u.profile_image, u.role as author_role,
             (SELECT COUNT(*) FROM forum_comments c WHERE c.post_id = p.id) as comments_count
      FROM forum_posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'visible'
      ORDER BY p.created_at DESC LIMIT $1 OFFSET $2
    `, [Number(limit), offset]);
    
    const countResult = await query("SELECT COUNT(*) as count FROM forum_posts WHERE status = 'visible'");
    const total = countResult.rows[0].count;

    return res.json({
      posts: postsResult.rows,
      total: Number(total),
      pages: Math.ceil(Number(total) / Number(limit))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.post('/posts', async (req: AuthRequest, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  try {
    const result = await query(
      'INSERT INTO forum_posts (author_id, title, content) VALUES ($1, $2, $3) RETURNING id',
      [req.user!.id, title, content]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create post' });
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const postResult = await query(`
      SELECT p.*, u.name as author_name, u.profile_image, u.role as author_role
      FROM forum_posts p JOIN users u ON p.author_id = u.id
      WHERE p.id = $1 AND p.status = 'visible'
    `, [req.params.id]);
    
    const post = postResult.rows[0];
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await query('UPDATE forum_posts SET views = views + 1 WHERE id = $1', [post.id]);

    const commentsResult = await query(`
      SELECT c.*, u.name as author_name, u.profile_image, u.role as author_role
      FROM forum_comments c JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1 AND c.status = 'visible'
      ORDER BY c.created_at ASC
    `, [req.params.id]);

    return res.json({ ...post, comments: commentsResult.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.post('/posts/:id/comments', async (req: AuthRequest, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  try {
    const result = await query(
      'INSERT INTO forum_comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING id',
      [req.params.id, req.user!.id, content]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
