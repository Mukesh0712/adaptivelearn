import { Schema, model, type InferSchemaType } from 'mongoose';

// A student asked to join a course that needs the instructor's approval.
// Separate from Enrollment on purpose: an Enrollment always means "is a
// member", so every existing access check stays correct without changes.
// Approving moves the student from here into Enrollment.
const joinRequestSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One open request per student per course (asking twice changes nothing).
joinRequestSchema.index({ course: 1, student: 1 }, { unique: true });
joinRequestSchema.index({ course: 1, createdAt: 1 }); // the instructor's queue, oldest first
joinRequestSchema.index({ student: 1 });

export type JoinRequest = InferSchemaType<typeof joinRequestSchema>;
export const JoinRequestModel = model('JoinRequest', joinRequestSchema);
