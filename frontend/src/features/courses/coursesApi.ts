import { baseApi } from '@/services/baseApi'
import type { Course, CourseInput, CourseResponse, CourseStatus, CourseStudent, EnrolledCourse } from './types'

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
      invalidatesTags: ['Courses'],
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
      invalidatesTags: ['Courses'],
    }),
    courseStudents: build.query<{ students: CourseStudent[] }, string>({
      query: (id) => `/courses/${id}/students`,
      providesTags: ['Courses'],
    }),
    removeStudent: build.mutation<{ message: string }, { courseId: string; studentId: string }>({
      query: ({ courseId, studentId }) => ({ url: `/courses/${courseId}/students/${studentId}`, method: 'DELETE' }),
      invalidatesTags: ['Courses'],
    }),
    // Student
    enrolledCourses: build.query<{ courses: EnrolledCourse[] }, void>({
      query: () => '/courses/enrolled',
      providesTags: ['Courses'],
    }),
    joinCourse: build.mutation<{ course: EnrolledCourse; message: string }, string>({
      query: (code) => ({ url: '/courses/join', method: 'POST', body: { code } }),
      invalidatesTags: ['Courses'],
    }),
    leaveCourse: build.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/courses/${id}/enrollment`, method: 'DELETE' }),
      invalidatesTags: ['Courses'],
    }),
    setCourseStatus: build.mutation<CourseResponse, { id: string; status: CourseStatus }>({
      query: ({ id, status }) => ({ url: `/courses/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['Courses'],
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
  useLeaveCourseMutation,
} = coursesApi
