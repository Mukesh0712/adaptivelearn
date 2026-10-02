import type { Types } from 'mongoose';
import { EnrollmentModel } from '../models/Enrollment.js';

// Number of students in each of the given courses, in ONE database query
// (an aggregation grouping enrolments by course), not one query per course.
export async function studentCounts(courseIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await EnrollmentModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: '$course', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}
