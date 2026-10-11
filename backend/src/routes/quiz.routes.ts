import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { aiLimiter, quizSaveLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import {
  addQuestion,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  getQuizForEditing,
  listQuizzes,
  reorderQuestions,
  updateQuestion,
  updateQuiz,
} from '../controllers/quiz.controller.js';
import {
  getAttempt,
  quizOverview,
  quizResults,
  reviewAttempt,
  saveAnswer,
  startAttempt,
  submitAttempt,
} from '../controllers/attempt.controller.js';
import { explainAnswer } from '../controllers/aiFeedback.controller.js';
import { orderSchema } from '../validators/content.schema.js';
import { answerSchema, newQuizSchema, questionSchema, updateQuizSchema } from '../validators/quiz.schema.js';

// Quizzes, mounted at /api/courses/:courseId (like course content). Every
// handler checks that the caller may edit this course (instructor/admin).
// authenticate is per route for the same reason as in content.routes.ts.
export const quizRouter = Router({ mergeParams: true });

quizRouter.get('/quizzes', authenticate, listQuizzes);
quizRouter.post('/quizzes', authenticate, validate(newQuizSchema), createQuiz);
quizRouter.get('/quizzes/:quizId/me', authenticate, quizOverview);
quizRouter.get('/quizzes/:quizId/results', authenticate, quizResults);
quizRouter.get('/quizzes/:quizId', authenticate, getQuizForEditing);
quizRouter.patch('/quizzes/:quizId', authenticate, validate(updateQuizSchema), updateQuiz);
quizRouter.delete('/quizzes/:quizId', authenticate, deleteQuiz);
quizRouter.post('/quizzes/:quizId/questions', authenticate, validate(questionSchema), addQuestion);
// Fixed path before /:questionId.
quizRouter.put('/quizzes/:quizId/questions/order', authenticate, validate(orderSchema), reorderQuestions);
quizRouter.put('/quizzes/:quizId/questions/:questionId', authenticate, validate(questionSchema), updateQuestion);
quizRouter.delete('/quizzes/:quizId/questions/:questionId', authenticate, deleteQuestion);

// Taking a quiz (students enrolled in the course).
quizRouter.post('/quizzes/:quizId/attempts', authenticate, startAttempt);
quizRouter.get('/attempts/:attemptId', authenticate, getAttempt);
quizRouter.put('/attempts/:attemptId/answers/:questionId', authenticate, quizSaveLimiter, validate(answerSchema), saveAnswer);
quizRouter.post('/attempts/:attemptId/submit', authenticate, submitAttempt);
// AI explanation of a wrong answer, after submitting.
quizRouter.post('/attempts/:attemptId/questions/:questionId/explain', authenticate, aiLimiter, explainAnswer);

// Results (instructor/admin of the course).
quizRouter.get('/quiz-attempts/:attemptId', authenticate, reviewAttempt);
