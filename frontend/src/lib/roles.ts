// Must match the Role enum in backend/src/models/User.ts.
export const ROLES = ['student', 'instructor', 'parent', 'admin'] as const
export type Role = (typeof ROLES)[number]

// Roles a user can pick on the public register form. Must match the backend.
// Instructors are invited by an Admin; admins are created with the seed script.
export const SELF_REGISTER_ROLES = ['student', 'parent'] as const
export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  instructor: 'Instructor',
  parent: 'Parent',
  admin: 'Admin',
}

// Where each role lands after login, and where it is sent back to if it
// tries to open another role's portal.
export const ROLE_HOME: Record<Role, string> = {
  student: '/student',
  instructor: '/instructor',
  parent: '/parent',
  admin: '/admin',
}
