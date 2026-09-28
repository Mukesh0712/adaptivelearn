import type { Role } from '@/lib/roles'

// Shape of a user as returned by the backend (User model's toJSON).
export interface User {
  id: string
  name: string
  email: string
  role: Role
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
  role: Exclude<Role, 'admin'>
  acceptTerms: boolean
  website: string // honeypot, always '' for real users
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
