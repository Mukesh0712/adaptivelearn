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

export type ResourceKind = 'video' | 'link' | 'file'
export const MAX_RESOURCES = 20
export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

// Allowed attachments; must match backend/src/utils/fileTypes.ts.
export const FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv', 'md']

// A video, link or file attached to a lesson (videos carry the parsed ID).
export interface Resource {
  id: string
  kind: ResourceKind
  title: string
  url: string
  provider?: 'youtube' | 'vimeo'
  videoId?: string
  hash?: string
  start?: number
  fileName?: string // files only
  size?: number // bytes
  mimeType?: string
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
  resources: Resource[]
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
