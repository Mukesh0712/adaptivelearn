import { Schema, model, type InferSchemaType } from 'mongoose';

// "This student finished this lesson." One document per (lesson, student):
// the unique index makes marking a lesson done twice impossible, even if
// two requests arrive at the same moment.
// course is stored too, so a whole course's progress is one indexed query.
const lessonProgressSchema = new Schema({
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, default: () => new Date() },
});

lessonProgressSchema.index({ lesson: 1, student: 1 }, { unique: true });
lessonProgressSchema.index({ course: 1, student: 1 });
lessonProgressSchema.index({ student: 1 }); // erase a user's data

export type LessonProgress = InferSchemaType<typeof lessonProgressSchema>;
export const LessonProgressModel = model('LessonProgress', lessonProgressSchema);
