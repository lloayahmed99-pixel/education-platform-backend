import { query } from '../database/db';

export const logActivity = async (
  userId: number,
  action: string,
  targetType: string | null = null,
  targetId: number | null = null,
  metadata: any = {}
) => {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, targetType, targetId, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
