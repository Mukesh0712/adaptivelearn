import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createCourse,
  listMyCourses,
  setCourseStatus,
  updateCourse,
} from '../controllers/course.controller.js';
import { courseStatusSchema, createCourseSchema, updateCourseSchema } from '../validators/course.schema.js';

// Course endpoints. Everyone must be logged in; each route says which roles
// may use it. (Student join/leave routes are added in the next step.)
export const courseRouter = Router();

courseRouter.use(authenticate);

courseRouter.get('/mine', authorize('instructor'), listMyCourses);
courseRouter.post('/', authorize('instructor'), validate(createCourseSchema), createCourse);
courseRouter.patch('/:id', authorize('instructor'), validate(updateCourseSchema), updateCourse);
courseRouter.patch('/:id/status', authorize('instructor'), validate(courseStatusSchema), setCourseStatus);
