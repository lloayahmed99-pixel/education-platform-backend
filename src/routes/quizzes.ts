import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { query } from '../database/db';
import { AuthRequest } from '../types';

const router = Router();

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const quizResult = await query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    const quiz = quizResult.rows[0];
    
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const questionsResult = await query('SELECT id, question_text, order_index FROM questions WHERE quiz_id = $1 ORDER BY order_index ASC', [quiz.id]);
    const questions = questionsResult.rows;

    for (const q of questions) {
      const answersResult = await query('SELECT id, answer_text FROM answers WHERE question_id = $1', [q.id]);
      q.answers = answersResult.rows;
    }

    quiz.questions = questions;
    return res.json(quiz);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

router.post('/:id/submit', authenticate, requireRole('student'), async (req: AuthRequest, res) => {
  const { answers } = req.body;
  try {
    const quizResult = await query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    const quiz = quizResult.rows[0];
    
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    let correctCount = 0;
    const questionsResult = await query('SELECT id FROM questions WHERE quiz_id = $1', [quiz.id]);
    const totalQuestions = questionsResult.rows.length;

    for (const [qId, aId] of Object.entries(answers)) {
      const isCorrectResult = await query('SELECT is_correct FROM answers WHERE id = $1 AND question_id = $2', [aId, qId]);
      if (isCorrectResult.rows[0] && isCorrectResult.rows[0].is_correct === 1) {
        correctCount++;
      }
    }

    const score = (correctCount / totalQuestions) * 100;
    const passed = score >= quiz.passing_score ? 1 : 0;

    await query(
      'INSERT INTO quiz_attempts (student_id, quiz_id, score, passed, answers_json, completed_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
      [req.user!.id, quiz.id, score, passed, JSON.stringify(answers)]
    );

    return res.json({ score, passed, correctCount, totalQuestions });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

router.get('/:id/attempts', authenticate, requireRole('student'), async (req: AuthRequest, res) => {
  try {
    const attempts = await query(
      'SELECT * FROM quiz_attempts WHERE student_id = $1 AND quiz_id = $2 ORDER BY started_at DESC',
      [req.user!.id, req.params.id]
    );
    return res.json(attempts.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

export default router;
