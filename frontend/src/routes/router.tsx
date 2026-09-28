import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import LoginPage from '@/features/auth/pages/LoginPage'
import RegisterPage from '@/features/auth/pages/RegisterPage'
import AdminDashboard from '@/portals/admin/AdminDashboard'
import InstructorDashboard from '@/portals/instructor/InstructorDashboard'
import ParentDashboard from '@/portals/parent/ParentDashboard'
import StudentDashboard from '@/portals/student/StudentDashboard'
import { GuestRoute, HomeRedirect, ProtectedRoute, RoleRoute } from './guards'

// Guards are nested "layout routes": a request for /admin passes through
// ProtectedRoute (logged in?) → AppLayout (page shell) → RoleRoute (admin?)
// before AdminDashboard renders.
export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/student',
            element: <RoleRoute allow={['student']} />,
            children: [{ index: true, element: <StudentDashboard /> }],
          },
          {
            path: '/instructor',
            element: <RoleRoute allow={['instructor']} />,
            children: [{ index: true, element: <InstructorDashboard /> }],
          },
          {
            path: '/parent',
            element: <RoleRoute allow={['parent']} />,
            children: [{ index: true, element: <ParentDashboard /> }],
          },
          {
            path: '/admin',
            element: <RoleRoute allow={['admin']} />,
            children: [{ index: true, element: <AdminDashboard /> }],
          },
        ],
      },
    ],
  },
  { path: '/', element: <HomeRedirect /> },
  { path: '*', element: <HomeRedirect /> }, // unknown URL → your home
])
