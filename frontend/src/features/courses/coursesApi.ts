import { baseApi } from '@/services/baseApi'
import type {
  Course,
  CourseInput,
  CourseResponse,
  CourseStatus,
  CourseStudent,
  EnrolledCourse,
  JoinCourseResponse,
  JoinRequestCourse,
} from './types'

// Every course query shares the 'Courses' tag, so any change (new course,
// join, leave, removal) refreshes counts and lists everywhere.

export const coursesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Instructor: own courses.
    myCourses: build.query<{ courses: Course[] }, void>({
      query: () => '/courses/mine',
      providesTags: ['Courses'],
    }),
    createCourse: build.mutation<CourseResponse, CourseInput>({
      query: (body) => ({ url: '/courses', method: 'POST', body }),
      invalidatesTags: ['Courses', 'AuditLogs'],
    }),
    updateCourse: build.mutation<CourseResponse, { id: string } & CourseInput>({
      query: ({ id, ...body }) => ({ url: `/courses/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Courses'],
    }),
    course: build.query<{ course: Course }, string>({
      query: (id) => `/courses/${id}`,
      providesTags: ['Courses'],
    }),
    regenerateJoinCode: build.mutation<CourseResponse, string>({
      query: (id) => ({ url: `/courses/${id}/join-code`, method: 'POST' }),
      invalidatesTags: ['Courses', 'AuditLogs'],
    }),
    courseStudents: build.query<{ students: CourseStudent[] }, string>({
      query: (id) => `/courses/${id}/students`,
      providesTags: ['Courses'],
    }),
    removeStudent: build.mutation<{ message: string }, { courseId: string; studentId: string }>({
      query: ({ courseId, studentId }) => ({ url: `/courses/${courseId}/students/${studentId}`, method: 'DELETE' }),
      invalidatesTags: ['Courses', 'AuditLogs'],
    }),
    // Student
    enrolledCourses: build.query<{ courses: EnrolledCourse[]; requests: JoinRequestCourse[] }, void>({
      query: () => '/courses/enrolled',
      providesTags: ['Courses'],
    }),
    joinCourse: build.mutation<JoinCourseResponse, string>({
      query: (code) => ({ url: '/courses/join', method: 'POST', body: { code } }),
      invalidatesTags: ['Courses', 'Approvals'],
    }),
    cancelJoinRequest: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/courses/${id}/join-request`, method: 'DELETE' }),
      invalidatesTags: ['Courses', 'Approvals'],
    }),
    // The course page's "Students need my approval to join" switch.
    setRequireApproval: build.mutation<CourseResponse, { id: string; requireApproval: boolean }>({
      query: ({ id, requireApproval }) => ({ url: `/courses/${id}`, method: 'PATCH', body: { requireApproval } }),
      invalidatesTags: ['Courses'],
      // Optimistic: the checkbox changes at once; undone if the server refuses.
      async onQueryStarted({ id, requireApproval }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          coursesApi.util.updateQueryData('course', id, (draft) => {
            draft.course.requireApproval = requireApproval
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
    }),
    leaveCourse: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/courses/${id}/enrollment`, method: 'DELETE' }),
      invalidatesTags: ['Courses'],
    }),
    deleteCourse: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/courses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Courses', 'AuditLogs'],
    }),
    setCourseStatus: build.mutation<CourseResponse, { id: string; status: CourseStatus }>({
      query: ({ id, status }) => ({ url: `/courses/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['Courses', 'AuditLogs'],
    }),
  }),
})

export const {
  useMyCoursesQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useSetCourseStatusMutation,
  useCourseQuery,
  useRegenerateJoinCodeMutation,
  useCourseStudentsQuery,
  useRemoveStudentMutation,
  useEnrolledCoursesQuery,
  useJoinCourseMutation,
  useCancelJoinRequestMutation,
  useSetRequireApprovalMutation,
  useLeaveCourseMutation,
  useDeleteCourseMutation,
} = coursesApi
