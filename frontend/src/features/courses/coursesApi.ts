import { baseApi } from '@/services/baseApi'
import type { Course, CourseInput, CourseResponse, CourseStatus } from './types'

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
} = coursesApi
