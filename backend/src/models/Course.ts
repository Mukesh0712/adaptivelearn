import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const COURSE_STATUSES = ['active', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    // Optional short code used by the institute, e.g. "CS201".
    code: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    // One instructor per course: the one who created it owns it.
    instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Students join with this code. Stored without the dash ("K7Q2MX"),
    // shown as "K7Q-2MX". unique → MongoDB itself rejects a duplicate.
    joinCode: { type: String, required: true, unique: true },
    // Archived courses are kept (never deleted) but hidden from students.
    status: { type: String, enum: COURSE_STATUSES, default: 'active' },
    // true when an Admin archived it (e.g. inappropriate content): the
    // instructor can't restore it themselves, only an Admin can.
    archivedByAdmin: { type: Boolean, default: false },
    // Set the first time a student joins, and never cleared. A course can only
    // be deleted while this is false: anything with history is archived instead.
    hasHadStudents: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// "My courses" for an instructor, newest first.
courseSchema.index({ instructor: 1, createdAt: -1 });

export type Course = InferSchemaType<typeof courseSchema>;
export type CourseDocument = HydratedDocument<Course>;

export const CourseModel = model('Course', courseSchema);
