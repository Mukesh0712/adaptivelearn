import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/app/hooks'
import { ROLE_HOME, type Role } from '@/lib/roles'

// Route guards. These only decide what the browser SHOWS; real security is
// enforced by the backend (authenticate + authorize middleware), since
// anything in the browser can be tampered with.

// Must be logged in. Otherwise → /login, remembering where the user wanted to go.
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

// Must have one of the allowed roles. Otherwise → the user's own portal.
export function RoleRoute({ allow }: { allow: Role[] }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />
  return <Outlet />
}

// Login/register pages: an already logged-in user is sent to their portal.
export function GuestRoute() {
  const { user } = useAuth()

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />
  return <Outlet />
}

// "/" → your portal if logged in, else the login page.
export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}
