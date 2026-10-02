import { baseApi } from '@/services/baseApi'

export interface InstructorDashboardData {
  stats: { activeCourses: number; archivedCourses: number; students: number; joinsThisWeek: number }
  courses: { id: string; title: string; code: string; joinCode: string; studentCount: number }[]
  recentJoins: { studentName: string; courseId: string; courseTitle: string; joinedAt: string }[]
}

export interface AdminDashboardData {
  stats: {
    students: number
    instructors: number
    parents: number
    pending: number
    invited: number
    activeCourses: number
    archivedCourses: number
    enrollments: number
  }
}

// Dashboards reuse the existing cache tags, so creating a course, a join,
// an approval… refreshes the numbers automatically.
export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    instructorDashboard: build.query<InstructorDashboardData, void>({
      query: () => '/dashboard/instructor',
      providesTags: ['Courses'],
    }),
    adminDashboard: build.query<AdminDashboardData, void>({
      query: () => '/dashboard/admin',
      providesTags: ['Users', 'Courses'],
    }),
  }),
})

export const { useInstructorDashboardQuery, useAdminDashboardQuery } = dashboardApi
