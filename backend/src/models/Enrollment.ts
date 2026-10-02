import { Schema, model, type InferSchemaType } from 'mongoose';

// One document per (course, student) pair: "this student is in this course".
// A separate collection rather than an array inside the course, because:
//  - a course's array would grow without limit (MongoDB caps a document at 16 MB);
//  - "my courses" for a student would mean searching inside every course;
//  - later phases attach per-student data (progress, grades) to the enrolment.
const enrollmentSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, required: true, default: Date.now },
  },
);

// Unique pair: joining twice is impossible, even with two clicks at the same
// moment (the database rejects the second insert). Also serves "students in
// this course" lookups.
enrollmentSchema.index({ course: 1, student: 1 }, { unique: true });
// "My courses" for a student, newest first.
enrollmentSchema.index({ student: 1, joinedAt: -1 });

export type Enrollment = InferSchemaType<typeof enrollmentSchema>;

export const EnrollmentModel = model('Enrollment', enrollmentSchema);
