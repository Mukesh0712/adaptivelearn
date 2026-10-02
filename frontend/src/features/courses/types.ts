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
  archivedByAdmin?: boolean // archived by an admin: only an admin can restore it
  studentCount?: number // included in the instructor's lists
  createdAt: string
  updatedAt: string
}

// What a student sees about a course they're in (no join code, no classmates).
export interface EnrolledCourse {
  id: string
  title: string
  code: string
  description: string
  instructorName: string
  joinedAt: string
}

// One row of an instructor's class list.
export interface CourseStudent {
  id: string
  name: string
  email: string
  status: 'active' | 'invited' | 'deactivated'
  joinedAt: string
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
