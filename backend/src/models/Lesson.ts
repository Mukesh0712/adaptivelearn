import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const LESSON_STATUSES = ['draft', 'published'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

const lessonSchema = new Schema(
  {
    // course is stored too (not only module) so "every lesson of a course"
    // and access checks need no extra lookup.
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    // The lesson text, written in Markdown. It's shown with react-markdown,
    // which never runs raw HTML, so lesson text can't inject scripts.
    content: { type: String, default: '', maxlength: 50_000 },
    // Order within the module.
    position: { type: Number, required: true, default: 0 },
    // Drafts are visible only to the instructor (and admins), never students.
    status: { type: String, enum: LESSON_STATUSES, default: 'draft' },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        ret.module = String(ret.module);
        ret.course = String(ret.course);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

lessonSchema.index({ module: 1, position: 1 });
lessonSchema.index({ course: 1 });

export type Lesson = InferSchemaType<typeof lessonSchema>;
export type LessonDocument = HydratedDocument<Lesson>;
export const LessonModel = model('Lesson', lessonSchema);
