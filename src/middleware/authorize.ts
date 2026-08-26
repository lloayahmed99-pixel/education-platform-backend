import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { query } from '../database/db';

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role' });
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role === 'moderator') {
      try {
        const result = await query(`
          SELECT p.name 
          FROM moderator_permissions mp
          JOIN permissions p ON mp.permission_id = p.id
          JOIN moderators m ON mp.moderator_id = m.id
          WHERE m.user_id = $1 AND p.name = $2
        `, [req.user.id, permission]);
        
        if (result.rows.length > 0) {
          return next();
        }
      } catch (err) {
        return res.status(500).json({ error: 'Database error' });
      }
    }

    return res.status(403).json({ error: `Forbidden: Requires permission ${permission}` });
  };
};
