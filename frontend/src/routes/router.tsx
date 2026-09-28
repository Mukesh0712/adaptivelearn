import { Suspense } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { FullPageLoader } from '@/components/FullPageLoader'
import { GuestRoute, HomeRedirect, ProtectedRoute, RoleRoute } from './guards'
import {
  AdminDashboard,
  AppLayout,
  ForgotPasswordPage,
  InstructorDashboard,
  LoginPage,
  ParentDashboard,
  RegisterPage,
  ResetPasswordPage,
  StudentDashboard,
} from './lazyPages'

// Guards are nested "layout routes": a request for /admin passes through
// ProtectedRoute (logged in?) → AppLayout (page shell) → RoleRoute (admin?)
// before AdminDashboard renders.
export const router = createBrowserRouter([
  {
    // Shows a spinner while a lazily loaded page's code is downloading.
    element: (
      <Suspense fallback={<FullPageLoader />}>
        <Outlet />
      </Suspense>
    ),
    children: [
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      // Not a guest-only page: the emailed link must work even if the user
      // happens to be logged in on this browser.
      { path: '/reset-password', element: <ResetPasswordPage /> },
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
    ],
  },
])
