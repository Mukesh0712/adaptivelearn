import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
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
} from '../controllers/content.controller.js';
import {
  moduleSchema,
  newLessonSchema,
  newResourceSchema,
  orderSchema,
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
contentRouter.post('/lessons/:lessonId/resources', authenticate, validate(newResourceSchema), addResource);
contentRouter.put('/lessons/:lessonId/resources/order', authenticate, validate(orderSchema), reorderResources);
contentRouter.delete('/lessons/:lessonId/resources/:resourceId', authenticate, deleteResource);
