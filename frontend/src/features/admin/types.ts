import type { User } from '@/features/auth/types'
import type { Role, UserStatus } from '@/lib/roles'

export interface ListUsersParams {
  q?: string
  role?: Role
  status?: UserStatus
  page: number
  pageSize: number
}

// A list response from the API plus where it sits in the full list.
export type Paginated<T> = T & {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ListUsersResponse = Paginated<{ users: User[] }>

// One row of the Admin → Courses table.
export interface AdminCourse {
  id: string
  title: string
  code: string
  status: 'active' | 'archived'
  archivedByAdmin: boolean
  instructor: { id: string; name: string; email: string } | null
  studentCount: number
  createdAt: string
}

export interface ListCoursesParams {
  q?: string
  status?: 'active' | 'archived'
  page: number
  pageSize: number
}

export interface InviteRequest {
  name: string
  email: string
  role: AssignableRole
}

// Roles an Admin can switch a user to. Must match ASSIGNABLE_ROLES in the backend.
export const ASSIGNABLE_ROLES = ['student', 'parent', 'instructor'] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export interface UserActionResponse {
  user: User
  message: string
}

export interface InviteResponse {
  user: User
  inviteLink: string
  expiresAt: string
  emailSent: boolean
  message: string
}

// Must match AUDIT_ACTIONS in backend/src/models/AuditLog.ts.
export type AuditAction =
  | 'user.invited'
  | 'invite.resent'
  | 'invite.accepted'
  | 'user.role_changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.approved'
  | 'user.rejected'
  | 'course.created'
  | 'course.archived'
  | 'course.restored'
  | 'course.code_reset'
  | 'course.student_removed'

// actor/target are filled in by the server; null if that user was deleted.
type AuditUser = Pick<User, 'name' | 'email' | 'role'> & { _id: string }

export interface AuditLog {
  id: string
  action: AuditAction
  actor: AuditUser | null
  target: AuditUser | null
  details: {
    name?: string
    email?: string
    role?: Role
    emailSent?: boolean
    from?: Role // role changes
    to?: Role
    wasInvited?: boolean // deactivation of a pending invite = cancelled
    status?: UserStatus // reactivation: 'active', or back to 'invited'
    courseId?: string // course events
    title?: string
    byAdmin?: boolean
  }
  createdAt: string
}
