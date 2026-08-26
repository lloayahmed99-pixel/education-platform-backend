import { Request } from 'express';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  profile_image: string | null;
  role: 'admin' | 'moderator' | 'student';
  status: 'active' | 'inactive' | 'suspended';
  points: number;
  created_at: string;
  updated_at: string;
}

export interface Moderator {
  id: number;
  user_id: number;
  created_by: number;
  status: string;
  created_at: string;
}

export interface Permission {
  id: number;
  name: string;
  description: string;
}

export interface Course {
  id: number;
  title: string;
  description: string | null;
  thumbnail: string | null;
  instructor_id: number | null;
  price: number;
  duration_hours: number;
  rating: number;
  students_count: number;
  published: number;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: number;
  course_id: number;
  title: string;
  order_index: number;
  created_at: string;
}

export interface Video {
  id: number;
  module_id: number;
  course_id: number;
  title: string;
  description: string | null;
  url: string;
  thumbnail: string | null;
  duration_seconds: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: number;
  student_id: number;
  course_id: number;
  status: 'active' | 'completed' | 'suspended';
  enrolled_at: string;
}

export interface VideoProgress {
  id: number;
  student_id: number;
  video_id: number;
  current_position: number;
  duration: number;
  completion_percentage: number;
  completed: number;
  last_watched_at: string;
}

export interface SavedVideo {
  id: number;
  student_id: number;
  video_id: number;
  saved_at: string;
}

export interface Quiz {
  id: number;
  course_id: number;
  module_id: number | null;
  title: string;
  description: string | null;
  passing_score: number;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: number;
  quiz_id: number;
  question_text: string;
  order_index: number;
}

export interface Answer {
  id: number;
  question_id: number;
  answer_text: string;
  is_correct: number;
}

export interface QuizAttempt {
  id: number;
  student_id: number;
  quiz_id: number;
  score: number;
  passed: number;
  answers_json: string;
  started_at: string;
  completed_at: string | null;
}

export interface ForumPost {
  id: number;
  author_id: number;
  title: string;
  content: string;
  status: 'visible' | 'hidden' | 'deleted';
  views: number;
  created_at: string;
  updated_at: string;
}

export interface ForumComment {
  id: number;
  post_id: number;
  author_id: number;
  content: string;
  status: 'visible' | 'hidden' | 'deleted';
  created_at: string;
}

export interface Report {
  id: number;
  reporter_id: number;
  target_type: 'post' | 'comment' | 'user';
  target_id: number;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number | null;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'course' | 'quiz';
  is_read: number;
  is_global: number;
  created_at: string;
}

export interface PlatformSetting {
  id: number;
  key: string;
  value: string | null;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  metadata: string;
  created_at: string;
}

export interface JWTPayload {
  id: number;
  email: string;
  role: 'admin' | 'moderator' | 'student';
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}
