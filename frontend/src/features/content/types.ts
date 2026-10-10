// Shapes returned by backend/src/controllers/content.controller.ts.

export type LessonStatus = 'draft' | 'published'

// Limits, matching backend/src/validators/content.schema.ts.
export const MODULE_TITLE_MAX = 120
export const LESSON_TITLE_MAX = 150
export const LESSON_CONTENT_MAX = 50_000

export interface OutlineLesson {
  id: string
  title: string
  status: LessonStatus
}

export interface OutlineModule {
  id: string
  title: string
  lessons: OutlineLesson[]
}

// GET /courses/:courseId/content : the course outline. Students get only
// published lessons (and no empty modules).
export interface CourseContent {
  course: { id: string; title: string; code: string; status: 'active' | 'archived' }
  canEdit: boolean
  modules: OutlineModule[]
}

export interface Lesson {
  id: string
  course: string
  module: string
  moduleTitle?: string
  title: string
  content: string // Markdown
  status: LessonStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LessonLink {
  id: string
  title: string
}

// GET /courses/:courseId/lessons/:lessonId
export interface LessonResponse {
  lesson: Lesson
  course: { id: string; title: string }
  canEdit: boolean
  previous: LessonLink | null
  next: LessonLink | null
}

export interface LessonChanges {
  title?: string
  content?: string
  status?: LessonStatus
}
