import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

// A section of a course ("Unit 1: Arrays"). Lessons belong to a module.
const moduleSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    // Order within the course: 0, 1, 2… (rewritten on every reorder).
    position: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// "The modules of this course, in order."
moduleSchema.index({ course: 1, position: 1 });

export type Module = InferSchemaType<typeof moduleSchema>;
export type ModuleDocument = HydratedDocument<Module>;
export const ModuleModel = model('Module', moduleSchema);
