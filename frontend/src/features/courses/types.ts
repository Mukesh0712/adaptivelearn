export type CourseStatus = 'active' | 'archived'

// Shape of a course as returned by the backend (Course model's toJSON).
export interface Course {
  id: string
  title: string
  code: string
  description: string
  instructor: string
  joinCode: string
  status: CourseStatus
  createdAt: string
  updatedAt: string
}

export interface CourseInput {
  title: string
  code: string
  description: string
}

export interface CourseResponse {
  course: Course
  message: string
}
