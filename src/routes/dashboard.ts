import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();

router.get('/student', authenticate, requireRole('student'), async (req: AuthRequest, res) => {
  try {
    const studentId = req.user!.id;
    
    const enrollmentsResult = await query('SELECT status, COUNT(*) as count FROM enrollments WHERE student_id = $1 GROUP BY status', [studentId]);
    const enrollments = enrollmentsResult.rows;
    const completedCourses = Number(enrollments.find((e: any) => e.status === 'completed')?.count || 0);
    const currentCourses = Number(enrollments.find((e: any) => e.status === 'active')?.count || 0);
    
    const savedVideosResult = await query('SELECT COUNT(*) as count FROM saved_videos WHERE student_id = $1', [studentId]);
    const savedVideos = Number(savedVideosResult.rows[0].count);
    
    const latestProgressResult = await query(`
      SELECT vp.*, v.title as video_title, c.id as course_id, c.title as course_title 
      FROM video_progress vp
      JOIN videos v ON vp.video_id = v.id
      JOIN courses c ON v.course_id = c.id
      WHERE vp.student_id = $1
      ORDER BY vp.last_watched_at DESC LIMIT 1
    `, [studentId]);
    const latestProgress = latestProgressResult.rows[0] || null;

    const videoStatsResult = await query('SELECT COUNT(*) as watched, SUM(completed) as completed, SUM(duration * completion_percentage / 100) as total_seconds FROM video_progress WHERE student_id = $1', [studentId]);
    const videoStats = videoStatsResult.rows[0];
    
    const quizStatsResult = await query('SELECT COUNT(*) as completed, AVG(score) as avg_score FROM quiz_attempts WHERE student_id = $1', [studentId]);
    const quizStats = quizStatsResult.rows[0];

    return res.json({
      completedCourses,
      currentCourses,
      savedVideos,
      latestProgress,
      weeklyActivity: [],
      totalLearningMinutes: Math.round(Number(videoStats.total_seconds || 0) / 60),
      videosWatched: Number(videoStats.watched || 0),
      videosCompleted: Number(videoStats.completed || 0),
      quizzesCompleted: Number(quizStats.completed || 0),
      averageQuizScore: Math.round(Number(quizStats.avg_score || 0))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

router.get('/admin', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const totalStudentsResult = await query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const activeStudentsResult = await query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'active'");
    const totalCoursesResult = await query("SELECT COUNT(*) as count FROM courses");
    const publishedCoursesResult = await query("SELECT COUNT(*) as count FROM courses WHERE published = 1");
    const totalVideosResult = await query("SELECT COUNT(*) as count FROM videos");
    const totalQuizzesResult = await query("SELECT COUNT(*) as count FROM quizzes");
    
    const enrollStatsResult = await query("SELECT status, COUNT(*) as count FROM enrollments GROUP BY status");
    const enrollStats = enrollStatsResult.rows;
    const totalEnrollments = enrollStats.reduce((sum, e) => sum + Number(e.count), 0);
    const completedEnrollments = Number(enrollStats.find((e: any) => e.status === 'completed')?.count || 0);
    
    const learningStatsResult = await query("SELECT SUM(duration * completion_percentage / 100) as total_seconds FROM video_progress");
    const learningStats = learningStatsResult.rows[0];
    
    const recentActivityResult = await query("SELECT a.*, u.name as user_name FROM activity_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 10");

    return res.json({
      totalStudents: Number(totalStudentsResult.rows[0].count),
      activeStudents: Number(activeStudentsResult.rows[0].count),
      totalCourses: Number(totalCoursesResult.rows[0].count),
      publishedCourses: Number(publishedCoursesResult.rows[0].count),
      totalVideos: Number(totalVideosResult.rows[0].count),
      totalQuizzes: Number(totalQuizzesResult.rows[0].count),
      totalEnrollments,
      completedEnrollments,
      totalLearningHours: Math.round(Number(learningStats.total_seconds || 0) / 3600),
      recentActivity: recentActivityResult.rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch admin dashboard' });
  }
});

router.get('/moderator', authenticate, requireRole('moderator', 'admin'), async (req, res) => {
  try {
    const totalStudentsResult = await query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const totalCoursesResult = await query('SELECT COUNT(*) as count FROM courses');
    const totalPostsResult = await query("SELECT COUNT(*) as count FROM forum_posts");
    const pendingReportsResult = await query("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'");
    
    return res.json({ 
      totalStudents: Number(totalStudentsResult.rows[0].count), 
      totalCourses: Number(totalCoursesResult.rows[0].count), 
      totalPosts: Number(totalPostsResult.rows[0].count), 
      pendingReports: Number(pendingReportsResult.rows[0].count) 
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch moderator dashboard' });
  }
});

export default router;
