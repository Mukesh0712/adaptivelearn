import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { CourseModel } from '../models/Course.js';
import { EnrollmentModel } from '../models/Enrollment.js';
import { UserModel } from '../models/User.js';
import { studentCounts } from '../utils/courseStats.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// GET /api/dashboard/instructor : everything the instructor dashboard shows,
// in one request. The queries that don't depend on each other run in parallel.
export async function instructorDashboard(req: Request, res: Response) {
  const courses = await CourseModel.find({ instructor: req.user!.id }).sort({ createdAt: -1 });
  const active = courses.filter((c) => c.status === 'active');
  const activeIds = active.map((c) => c._id);

  const [counts, uniqueStudents, joinsThisWeek, recent] = await Promise.all([
    studentCounts(activeIds),
    // A student in two of my courses counts once: count DISTINCT students.
    EnrollmentModel.distinct('student', { course: { $in: activeIds } }),
    EnrollmentModel.countDocuments({
      course: { $in: activeIds },
      joinedAt: { $gte: new Date(Date.now() - WEEK_MS) },
    }),
    EnrollmentModel.find({ course: { $in: activeIds } })
      .sort({ joinedAt: -1 })
      .limit(8)
      .populate<{ student: { name: string } | null }>('student', 'name')
      .populate<{ course: { _id: Types.ObjectId; title: string } | null }>('course', 'title'),
  ]);

  res.json({
    stats: {
      activeCourses: active.length,
      archivedCourses: courses.length - active.length,
      students: uniqueStudents.length,
      joinsThisWeek,
    },
    courses: active.slice(0, 6).map((c) => ({
      id: c.id,
      title: c.title,
      code: c.code,
      joinCode: c.joinCode,
      studentCount: counts.get(c.id) ?? 0,
    })),
    recentJoins: recent
      .filter((e) => e.student && e.course)
      .map((e) => ({
        studentName: e.student!.name,
        courseId: String(e.course!._id),
        courseTitle: e.course!.title,
        joinedAt: e.joinedAt,
      })),
  });
}

// GET /api/dashboard/admin : platform-wide counts.
// Users are counted with ONE aggregation that groups by (role, status),
// instead of a separate count query for every combination.
export async function adminDashboard(_req: Request, res: Response) {
  const [userGroups, courseGroups, enrollments] = await Promise.all([
    UserModel.aggregate<{ _id: { role: string; status: string }; n: number }>([
      // Accounts saved before statuses existed have none: they're active.
      { $group: { _id: { role: '$role', status: { $ifNull: ['$status', 'active'] } }, n: { $sum: 1 } } },
    ]),
    CourseModel.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    EnrollmentModel.estimatedDocumentCount(),
  ]);

  const users = (role: string, status = 'active') =>
    userGroups.find((g) => g._id.role === role && g._id.status === status)?.n ?? 0;
  const byStatus = (status: string) => userGroups.filter((g) => g._id.status === status).reduce((s, g) => s + g.n, 0);
  const courses = (status: string) => courseGroups.find((g) => g._id === status)?.n ?? 0;

  res.json({
    stats: {
      students: users('student'),
      instructors: users('instructor'),
      parents: users('parent'),
      pending: byStatus('pending'),
      invited: byStatus('invited'),
      activeCourses: courses('active'),
      archivedCourses: courses('archived'),
      enrollments,
    },
  });
}
