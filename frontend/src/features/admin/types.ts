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
