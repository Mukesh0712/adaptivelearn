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

export interface InviteRequest {
  name: string
  email: string
  role: 'instructor'
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
  }
  createdAt: string
}
