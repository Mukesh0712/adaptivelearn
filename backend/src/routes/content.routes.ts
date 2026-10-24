import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { summarizeLesson } from '../controllers/aiTools.controller.js';
import { lessonChat } from '../controllers/aiChat.controller.js';
import { lessonChatSchema } from '../validators/ai.schema.js';
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  getContent,
  getLesson,
  renameModule,
  reorderLessons,
  reorderModules,
  updateLesson,
  addResource,
  deleteResource,
  reorderResources,
  uploadResourceFile,
  downloadResourceFile,
  setProgress,
} from '../controllers/content.controller.js';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimiters.js';
import {
  moduleSchema,
  newLessonSchema,
  newResourceSchema,
  orderSchema,
  progressSchema,
  updateLessonSchema,
} from '../validators/content.schema.js';

// Course content, mounted at /api/courses/:courseId. Who may read or change
// it is decided inside, per request (instructor/admin edit, enrolled
// students read published lessons).
//
// authenticate is listed on each route rather than with router.use(): this
// router sits in front of the course router, and a router-wide use() would
// also run for every other /api/courses/... request (a second DB lookup).
export const contentRouter = Router({ mergeParams: true });

contentRouter.get('/content', authenticate, getContent);
contentRouter.post('/modules', authenticate, validate(moduleSchema), createModule);
// Fixed path before /:moduleId (see course.routes.ts for why order matters).
contentRouter.put('/modules/order', authenticate, validate(orderSchema), reorderModules);
contentRouter.patch('/modules/:moduleId', authenticate, validate(moduleSchema), renameModule);
contentRouter.delete('/modules/:moduleId', authenticate, deleteModule);
contentRouter.post('/modules/:moduleId/lessons', authenticate, validate(newLessonSchema), createLesson);
contentRouter.put('/modules/:moduleId/lessons/order', authenticate, validate(orderSchema), reorderLessons);
contentRouter.get('/lessons/:lessonId', authenticate, getLesson);
contentRouter.patch('/lessons/:lessonId', authenticate, validate(updateLessonSchema), updateLesson);
contentRouter.delete('/lessons/:lessonId', authenticate, deleteLesson);
// AI summary of the saved lesson text (instructor/admin).
contentRouter.post('/lessons/:lessonId/ai/summary', authenticate, aiLimiter, summarizeLesson);
// Study assistant: a student's question about this lesson.
contentRouter.post('/lessons/:lessonId/ai/chat', authenticate, aiLimiter, validate(lessonChatSchema), lessonChat);
contentRouter.post('/lessons/:lessonId/resources', authenticate, validate(newResourceSchema), addResource);
contentRouter.put('/lessons/:lessonId/resources/order', authenticate, validate(orderSchema), reorderResources);
contentRouter.delete('/lessons/:lessonId/resources/:resourceId', authenticate, deleteResource);
// File attachments (multipart upload, not JSON, so no validate() here: the
// controller checks the file and its title itself).
contentRouter.post('/lessons/:lessonId/files', authenticate, uploadLimiter, uploadResourceFile);
contentRouter.get('/lessons/:lessonId/resources/:resourceId/file', authenticate, downloadResourceFile);
contentRouter.put('/lessons/:lessonId/progress', authenticate, validate(progressSchema), setProgress);
