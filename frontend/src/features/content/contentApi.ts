import { baseApi } from '@/services/baseApi'
import type { CourseContent, Lesson, LessonChanges, LessonResponse, Resource, ResourceKind } from './types'
import { saveBlob } from './utils'

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
    // Videos and links are saved straight away, separately from the text.
    addResource: build.mutation<
      { resource: Resource } & Message,
      CourseArg & { lessonId: string; kind: ResourceKind; url: string; title: string }
    >({
      query: ({ courseId, lessonId, ...body }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}/resources`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Content'],
    }),
    // multipart/form-data: the browser sets the Content-Type (with its
    // boundary) itself when the body is a FormData.
    uploadFile: build.mutation<{ resource: Resource } & Message, CourseArg & { lessonId: string; file: File }>({
      query: ({ courseId, lessonId, file }) => {
        const body = new FormData()
        body.append('file', file)
        return { url: `/courses/${courseId}/lessons/${lessonId}/files`, method: 'POST', body }
      },
      invalidatesTags: ['Content'],
    }),
    // Downloads go through our API (with the login token), which checks
    // access and streams the file from storage. The bytes are saved
    // straight away, never kept in the Redux store.
    downloadFile: build.mutation<null, CourseArg & { lessonId: string; resourceId: string; fileName: string }>({
      query: ({ courseId, lessonId, resourceId, fileName }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}/resources/${resourceId}/file`,
        responseHandler: async (response) => {
          if (!response.ok) return response.json().catch(() => null)
          saveBlob(await response.blob(), fileName)
          return null
        },
      }),
    }),
    deleteResource: build.mutation<Message, CourseArg & { lessonId: string; resourceId: string }>({
      query: ({ courseId, lessonId, resourceId }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}/resources/${resourceId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Content'],
    }),
    reorderResources: build.mutation<Message, CourseArg & { lessonId: string; ids: string[] }>({
      query: ({ courseId, lessonId, ids }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}/resources/order`,
        method: 'PUT',
        body: { ids },
      }),
      // Instant, like the module/lesson arrows above.
      async onQueryStarted({ courseId, lessonId, ids }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          contentApi.util.updateQueryData('lesson', { courseId, lessonId }, (draft) => {
            draft.lesson.resources.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
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
  useAddResourceMutation,
  useUploadFileMutation,
  useDownloadFileMutation,
  useDeleteResourceMutation,
  useReorderResourcesMutation,
} = contentApi
