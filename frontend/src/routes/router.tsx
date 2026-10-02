import { Suspense } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { FullPageLoader } from '@/components/FullPageLoader'
import { RouteError } from '@/components/RouteError'
import { GuestRoute, HomeRedirect, ProtectedRoute, RoleRoute } from './guards'
import {
  AcceptInvitePage,
  AdminActivityPage,
  AdminCoursesPage,
  AdminDashboard,
  AdminUsersPage,
  AppLayout,
  ForgotPasswordPage,
  InstructorCourseDetailPage,
  InstructorCoursesPage,
  InstructorDashboard,
  LoginPage,
  NotFoundPage,
  ParentDashboard,
  PrivacyPage,
  RegisterPage,
  ResetPasswordPage,
  StudentCoursesPage,
  StudentDashboard,
  TermsPage,
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
    // Any error not caught lower down: full-screen friendly error page.
    errorElement: <RouteError />,
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
      { path: '/accept-invite', element: <AcceptInvitePage /> },
      // Public legal pages, reachable whether or not the visitor is logged in.
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/terms', element: <TermsPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: '/student',
                element: <RoleRoute allow={['student']} />,
                errorElement: <RouteError inLayout />,
                children: [
                  { index: true, element: <StudentDashboard /> },
                  { path: 'courses', element: <StudentCoursesPage /> },
                ],
              },
              {
                path: '/instructor',
                element: <RoleRoute allow={['instructor']} />,
                errorElement: <RouteError inLayout />,
                children: [
                  { index: true, element: <InstructorDashboard /> },
                  { path: 'courses', element: <InstructorCoursesPage /> },
                  { path: 'courses/:courseId', element: <InstructorCourseDetailPage /> },
                ],
              },
              {
                path: '/parent',
                element: <RoleRoute allow={['parent']} />,
                errorElement: <RouteError inLayout />,
                children: [{ index: true, element: <ParentDashboard /> }],
              },
              {
                path: '/admin',
                element: <RoleRoute allow={['admin']} />,
                errorElement: <RouteError inLayout />,
                children: [
                  { index: true, element: <AdminDashboard /> },
                  { path: 'users', element: <AdminUsersPage /> },
                  { path: 'courses', element: <AdminCoursesPage /> },
                  { path: 'activity', element: <AdminActivityPage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '/', element: <HomeRedirect /> },
      { path: '*', element: <NotFoundPage /> }, // unknown URL → 404 page
    ],
  },
])
