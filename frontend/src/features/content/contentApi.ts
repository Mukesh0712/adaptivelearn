import { baseApi } from '@/services/baseApi'
import type { CourseContent, Lesson, LessonChanges, LessonResponse } from './types'

type Message = { message: string }
type CourseArg = { courseId: string }

// Course content (modules and lessons). Everything shares the 'Content' tag,
// so any change refreshes the outline and the open lesson.
export const contentApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    courseContent: build.query<CourseContent, string>({
      query: (courseId) => `/courses/${courseId}/content`,
      providesTags: ['Content'],
    }),
    createModule: build.mutation<Message, CourseArg & { title: string }>({
      query: ({ courseId, title }) => ({ url: `/courses/${courseId}/modules`, method: 'POST', body: { title } }),
      invalidatesTags: ['Content'],
    }),
    renameModule: build.mutation<Message, CourseArg & { moduleId: string; title: string }>({
      query: ({ courseId, moduleId, title }) => ({
        url: `/courses/${courseId}/modules/${moduleId}`,
        method: 'PATCH',
        body: { title },
      }),
      invalidatesTags: ['Content'],
    }),
    deleteModule: build.mutation<Message, CourseArg & { moduleId: string }>({
      query: ({ courseId, moduleId }) => ({ url: `/courses/${courseId}/modules/${moduleId}`, method: 'DELETE' }),
      invalidatesTags: ['Content'],
    }),
    // Reordering updates the cached outline at once ("optimistic update"),
    // so the arrows feel instant. If the server refuses, the outline is
    // refetched and snaps back to the real order.
    reorderModules: build.mutation<Message, CourseArg & { ids: string[] }>({
      query: ({ courseId, ids }) => ({ url: `/courses/${courseId}/modules/order`, method: 'PUT', body: { ids } }),
      async onQueryStarted({ courseId, ids }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          contentApi.util.updateQueryData('courseContent', courseId, (draft) => {
            draft.modules.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
          dispatch(contentApi.util.invalidateTags(['Content']))
        }
      },
    }),
    createLesson: build.mutation<{ lesson: Lesson } & Message, CourseArg & { moduleId: string; title: string }>({
      query: ({ courseId, moduleId, title }) => ({
        url: `/courses/${courseId}/modules/${moduleId}/lessons`,
        method: 'POST',
        body: { title },
      }),
      invalidatesTags: ['Content'],
    }),
    reorderLessons: build.mutation<Message, CourseArg & { moduleId: string; ids: string[] }>({
      query: ({ courseId, moduleId, ids }) => ({
        url: `/courses/${courseId}/modules/${moduleId}/lessons/order`,
        method: 'PUT',
        body: { ids },
      }),
      async onQueryStarted({ courseId, moduleId, ids }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          contentApi.util.updateQueryData('courseContent', courseId, (draft) => {
            draft.modules
              .find((m) => m.id === moduleId)
              ?.lessons.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
          dispatch(contentApi.util.invalidateTags(['Content']))
        }
      },
    }),
    lesson: build.query<LessonResponse, CourseArg & { lessonId: string }>({
      query: ({ courseId, lessonId }) => `/courses/${courseId}/lessons/${lessonId}`,
      providesTags: ['Content'],
    }),
    updateLesson: build.mutation<{ lesson: Lesson } & Message, CourseArg & { lessonId: string } & LessonChanges>({
      query: ({ courseId, lessonId, ...body }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Content'],
    }),
    deleteLesson: build.mutation<Message, CourseArg & { lessonId: string }>({
      query: ({ courseId, lessonId }) => ({ url: `/courses/${courseId}/lessons/${lessonId}`, method: 'DELETE' }),
      invalidatesTags: ['Content'],
    }),
  }),
})

export const {
  useCourseContentQuery,
  useCreateModuleMutation,
  useRenameModuleMutation,
  useDeleteModuleMutation,
  useReorderModulesMutation,
  useCreateLessonMutation,
  useReorderLessonsMutation,
  useLessonQuery,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
} = contentApi
