import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validateBody = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
        });
      }
      return res.status(400).json({ error: 'Invalid input' });
    }
  };
};
