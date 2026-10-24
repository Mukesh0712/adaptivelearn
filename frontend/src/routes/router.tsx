import { Suspense } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { FullPageLoader } from '@/components/FullPageLoader'
import { RouteError } from '@/components/RouteError'
import { GuestRoute, HomeRedirect, ProtectedRoute, RoleRoute } from './guards'
import {
  AcceptInvitePage,
  AdminActivityPage,
  ApprovalsPage,
  AdminCoursesPage,
  AdminDashboard,
  AdminUsersPage,
  AppLayout,
  AttemptPage,
  ForgotPasswordPage,
  InstructorCourseDetailPage,
  InstructorCoursesPage,
  InstructorAttemptPage,
  ClassInsightsPage,
  InstructorDashboard,
  LessonEditorPage,
  LessonReaderPage,
  LoginPage,
  NotFoundPage,
  ParentDashboard,
  PrivacyPage,
  ProfilePage,
  QuizEditorPage,
  QuizOverviewPage,
  QuizResultsPage,
  RegisterPage,
  ResetPasswordPage,
  StudentCoursePage,
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
                  { path: 'courses/:courseId', element: <StudentCoursePage /> },
                  { path: 'courses/:courseId/lessons/:lessonId', element: <LessonReaderPage /> },
                  { path: 'courses/:courseId/quizzes/:quizId', element: <QuizOverviewPage /> },
                  { path: 'courses/:courseId/quizzes/:quizId/attempts/:attemptId', element: <AttemptPage /> },
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
                  { path: 'courses/:courseId/lessons/:lessonId', element: <LessonEditorPage /> },
                  { path: 'courses/:courseId/quizzes/:quizId', element: <QuizEditorPage /> },
                  { path: 'courses/:courseId/quizzes/:quizId/results', element: <QuizResultsPage /> },
                  { path: 'courses/:courseId/quizzes/:quizId/attempts/:attemptId', element: <InstructorAttemptPage /> },
                  { path: 'courses/:courseId/insights', element: <ClassInsightsPage /> },
                  { path: 'requests', element: <ApprovalsPage /> },
                ],
              },
              {
                path: '/parent',
                element: <RoleRoute allow={['parent']} />,
                errorElement: <RouteError inLayout />,
                children: [{ index: true, element: <ParentDashboard /> }],
              },
              // Every role's own account page (no RoleRoute: all roles may open it).
              { path: '/profile', element: <ProfilePage />, errorElement: <RouteError inLayout /> },
              {
                path: '/admin',
                element: <RoleRoute allow={['admin']} />,
                errorElement: <RouteError inLayout />,
                children: [
                  { index: true, element: <AdminDashboard /> },
                  { path: 'users', element: <AdminUsersPage /> },
                  { path: 'approvals', element: <ApprovalsPage /> },
                  { path: 'courses', element: <AdminCoursesPage /> },
                  // Same page as the instructor's; the admin sees extra controls.
                  { path: 'courses/:courseId', element: <InstructorCourseDetailPage /> },
                  { path: 'courses/:courseId/lessons/:lessonId', element: <LessonEditorPage /> },
                  { path: 'courses/:courseId/quizzes/:quizId', element: <QuizEditorPage /> },
                  { path: 'courses/:courseId/quizzes/:quizId/results', element: <QuizResultsPage /> },
                  { path: 'courses/:courseId/quizzes/:quizId/attempts/:attemptId', element: <InstructorAttemptPage /> },
                  { path: 'courses/:courseId/insights', element: <ClassInsightsPage /> },
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
