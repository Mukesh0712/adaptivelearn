import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
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
import { orderSchema } from '../validators/content.schema.js';
import { newQuizSchema, questionSchema, updateQuizSchema } from '../validators/quiz.schema.js';

// Quizzes, mounted at /api/courses/:courseId (like course content). Every
// handler checks that the caller may edit this course (instructor/admin).
// authenticate is per route for the same reason as in content.routes.ts.
export const quizRouter = Router({ mergeParams: true });

quizRouter.get('/quizzes', authenticate, listQuizzes);
quizRouter.post('/quizzes', authenticate, validate(newQuizSchema), createQuiz);
quizRouter.get('/quizzes/:quizId', authenticate, getQuizForEditing);
quizRouter.patch('/quizzes/:quizId', authenticate, validate(updateQuizSchema), updateQuiz);
quizRouter.delete('/quizzes/:quizId', authenticate, deleteQuiz);
quizRouter.post('/quizzes/:quizId/questions', authenticate, validate(questionSchema), addQuestion);
// Fixed path before /:questionId.
quizRouter.put('/quizzes/:quizId/questions/order', authenticate, validate(orderSchema), reorderQuestions);
quizRouter.put('/quizzes/:quizId/questions/:questionId', authenticate, validate(questionSchema), updateQuestion);
quizRouter.delete('/quizzes/:quizId/questions/:questionId', authenticate, deleteQuestion);
