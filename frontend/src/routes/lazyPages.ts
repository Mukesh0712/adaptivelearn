import { lazy } from 'react'

// Lazy loading: each page's code is a separate file that the browser only
// downloads when that page is first opened, so the first load is smaller.
export const AppLayout = lazy(() => import('@/components/layout/AppLayout'))
export const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
export const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
export const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
export const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
export const AcceptInvitePage = lazy(() => import('@/features/auth/pages/AcceptInvitePage'))
export const StudentDashboard = lazy(() => import('@/portals/student/StudentDashboard'))
export const InstructorDashboard = lazy(() => import('@/portals/instructor/InstructorDashboard'))
export const ParentDashboard = lazy(() => import('@/portals/parent/ParentDashboard'))
export const AdminDashboard = lazy(() => import('@/portals/admin/AdminDashboard'))
export const AdminUsersPage = lazy(() => import('@/portals/admin/UsersPage'))
export const AdminActivityPage = lazy(() => import('@/portals/admin/ActivityPage'))
export const PrivacyPage = lazy(() => import('@/features/legal/PrivacyPage'))
export const TermsPage = lazy(() => import('@/features/legal/TermsPage'))
export const NotFoundPage = lazy(() => import('@/features/NotFoundPage'))
