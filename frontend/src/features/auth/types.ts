import type { Role, SelfRegisterRole, UserStatus } from '@/lib/roles'

// Shape of a user as returned by the backend (User model's toJSON).
export interface User {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  lastLoginAt?: string | null
  invitedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  user: User
  accessToken: string
}

export interface LoginRequest {
  email: string
  password: string
  rememberMe: boolean
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  role: SelfRegisterRole
  acceptTerms: boolean
  website: string // honeypot, always '' for real users
}

export interface InviteDetails {
  name: string
  email: string
  role: Role
}

export interface MessageResponse {
  message: string
}

export interface RegisterResponse {
  user?: User
  message: string
}

// Error body sent by the backend's errorHandler.
export interface ApiErrorBody {
  message: string
  details?: Record<string, string[]>
}
