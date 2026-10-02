import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { joinCourseLimiter } from '../middleware/rateLimiters.js';
import {
  createCourse,
  deleteCourse,
  getCourse,
  joinCourse,
  leaveCourse,
  listEnrolledCourses,
  listMyCourses,
  listStudents,
  regenerateJoinCode,
  removeStudent,
  setCourseStatus,
  updateCourse,
} from '../controllers/course.controller.js';
import {
  courseStatusSchema,
  createCourseSchema,
  joinCourseSchema,
  updateCourseSchema,
} from '../validators/course.schema.js';

// Course endpoints. Everyone must be logged in; each route says which roles
// may use it.
export const courseRouter = Router();

courseRouter.use(authenticate);

// Fixed paths first: Express matches routes in order, so if /:id came
// first, GET /enrolled would be treated as "the course with id 'enrolled'".

// Instructor
courseRouter.get('/mine', authorize('instructor'), listMyCourses);
courseRouter.post('/', authorize('instructor'), validate(createCourseSchema), createCourse);

// Student
courseRouter.get('/enrolled', authorize('student'), listEnrolledCourses);
courseRouter.post('/join', authorize('student'), joinCourseLimiter, validate(joinCourseSchema), joinCourse);
courseRouter.delete('/:id/enrollment', authorize('student'), leaveCourse);

// One course: its own instructor, or any admin (checked inside, in ownCourse).
const manager = authorize('instructor', 'admin');
courseRouter.get('/:id', manager, getCourse);
courseRouter.patch('/:id', manager, validate(updateCourseSchema), updateCourse);
courseRouter.delete('/:id', manager, deleteCourse);
courseRouter.post('/:id/join-code', manager, regenerateJoinCode);
courseRouter.get('/:id/students', manager, listStudents);
courseRouter.delete('/:id/students/:studentId', manager, removeStudent);
// Archive/restore by the instructor (admins use /api/admin/courses/:id/status,
// which also marks the course as archived by an admin).
courseRouter.patch('/:id/status', authorize('instructor'), validate(courseStatusSchema), setCourseStatus);
