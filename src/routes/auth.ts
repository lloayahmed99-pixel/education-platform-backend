import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../database/db';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { User, AuthRequest } from '../types';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hash, 'student']
    );
      
    const userId = result.rows[0].id;
    const token = jwt.sign(
      { id: userId, email, role: 'student' },
      process.env.JWT_SECRET || 'arabic_edu_platform_super_secret_jwt_key_2024',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({ token, user: { id: userId, name, email, role: 'student' } });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0] as User | undefined;
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'arabic_edu_platform_super_secret_jwt_key_2024',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, profile_image, role, status, points, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
