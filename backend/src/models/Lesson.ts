import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const LESSON_STATUSES = ['draft', 'published'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const RESOURCE_KINDS = ['video', 'link', 'file'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export const MAX_RESOURCES = 20;

// A video, link or file attached to a lesson, stored inside the lesson
// document (always read together with it, never on its own).
//  - video: only the provider and the video ID are kept (see utils/videoUrl.ts),
//    plus the link as pasted, to show the instructor;
//  - link: any http(s) address, shown to students as a card;
//  - file: stored in Cloudinary (see utils/fileStorage.ts). publicId is its
//    name there; it is never sent to the browser.
const resourceSchema = new Schema({
  kind: { type: String, enum: RESOURCE_KINDS, required: true },
  title: { type: String, trim: true, maxlength: 150, default: '' },
  url: { type: String, maxlength: 2000, default: '' }, // video and link
  fileName: { type: String },
  size: { type: Number }, // bytes
  mimeType: { type: String },
  publicId: { type: String },
  provider: { type: String, enum: ['youtube', 'vimeo'] },
  videoId: { type: String },
  hash: { type: String },
  start: { type: Number },
});

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
    // Shown in this order: videos above the text, links below it.
    resources: { type: [resourceSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        ret.module = String(ret.module);
        ret.course = String(ret.course);
        // publicId stays on the server: downloads go through our API.
        ret.resources = ((ret.resources ?? []) as Record<string, unknown>[]).map(({ _id, publicId: _p, ...r }) => ({
          id: String(_id),
          ...r,
        }));
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
