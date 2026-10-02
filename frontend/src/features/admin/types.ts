import type { User } from '@/features/auth/types'
import type { Role, UserStatus } from '@/lib/roles'

export interface ListUsersParams {
  q?: string
  role?: Role
  status?: UserStatus
  page: number
  pageSize: number
}

export interface ListUsersResponse {
  users: User[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface InviteRequest {
  name: string
  email: string
  role: 'instructor'
}

export interface InviteResponse {
  user: User
  inviteLink: string
  expiresAt: string
  emailSent: boolean
  message: string
}

// Must match AUDIT_ACTIONS in backend/src/models/AuditLog.ts.
export type AuditAction = 'user.invited' | 'invite.accepted'

// actor/target are filled in by the server; null if that user was deleted.
type AuditUser = Pick<User, 'name' | 'email' | 'role'> & { _id: string }

export interface AuditLog {
  id: string
  action: AuditAction
  actor: AuditUser | null
  target: AuditUser | null
  details: { name?: string; email?: string; role?: Role; emailSent?: boolean }
  createdAt: string
}
