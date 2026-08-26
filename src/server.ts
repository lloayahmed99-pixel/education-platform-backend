import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import coursesRoutes from './routes/courses';
import videosRoutes from './routes/videos';
import quizzesRoutes from './routes/quizzes';
import progressRoutes from './routes/progress';
import enrollmentsRoutes from './routes/enrollments';
import savedVideosRoutes from './routes/savedVideos';
import forumRoutes from './routes/forum';
import notificationsRoutes from './routes/notifications';
import settingsRoutes from './routes/settings';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import moderatorRoutes from './routes/moderator';

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/saved-videos', savedVideosRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/moderator', moderatorRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


