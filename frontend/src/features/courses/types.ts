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
  hasHadStudents?: boolean // someone has joined at some point
  canDelete?: boolean // nobody ever joined, so it may be deleted
  requireApproval: boolean // joining with the code only sends a request
  pendingRequests?: number // join requests waiting (course page only)
  // Only in the admin's view of a course page.
  instructorInfo?: { id: string; name: string; email: string; status?: string }
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
  progress: { done: number; total: number }
}

// One row of an instructor's class list.
export interface CourseStudent {
  id: string
  name: string
  email: string
  status: 'active' | 'invited' | 'deactivated'
  joinedAt: string
  progress: { done: number; total: number }
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

// A course the student asked to join; waiting for the instructor.
export interface JoinRequestCourse {
  id: string
  title: string
  code: string
  instructorName: string
  requestedAt: string
}

// POST /courses/join : joined at once, or a request was sent.
export type JoinCourseResponse =
  | { status: 'joined'; course: EnrolledCourse; message: string }
  | { status: 'pending'; request: { course: JoinRequestCourse }; message: string }
