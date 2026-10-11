import { baseApi } from '@/services/baseApi'
import type { Question, QuestionInput, Quiz, QuizEditorData, QuizKind, QuizSettings, QuizSummary } from './types'

type Message = { message: string }
type QuizArg = { courseId: string; quizId: string }

// Quiz builder (instructor/admin). Everything shares the 'Quizzes' tag;
// changes that show up in the course outline also refresh 'Content'.
export const quizApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    courseQuizzes: build.query<{ quizzes: QuizSummary[] }, string>({
      query: (courseId) => `/courses/${courseId}/quizzes`,
      providesTags: ['Quizzes'],
    }),
    createQuiz: build.mutation<{ quiz: Quiz } & Message, { courseId: string; title: string; module: string | null; kind: QuizKind }>({
      query: ({ courseId, ...body }) => ({ url: `/courses/${courseId}/quizzes`, method: 'POST', body }),
      invalidatesTags: ['Quizzes', 'Content'],
    }),
    quizForEditing: build.query<QuizEditorData, QuizArg>({
      query: ({ courseId, quizId }) => `/courses/${courseId}/quizzes/${quizId}`,
      providesTags: ['Quizzes'],
    }),
    updateQuiz: build.mutation<{ quiz: Quiz; publishProblems: string[] } & Message, QuizArg & { changes: QuizSettings }>({
      query: ({ courseId, quizId, changes }) => ({ url: `/courses/${courseId}/quizzes/${quizId}`, method: 'PATCH', body: changes }),
      invalidatesTags: ['Quizzes', 'Content'],
    }),
    deleteQuiz: build.mutation<Message, QuizArg>({
      query: ({ courseId, quizId }) => ({ url: `/courses/${courseId}/quizzes/${quizId}`, method: 'DELETE' }),
      invalidatesTags: ['Quizzes', 'Content'],
    }),
    addQuestion: build.mutation<{ question: Question } & Message, QuizArg & { question: QuestionInput }>({
      query: ({ courseId, quizId, question }) => ({
        url: `/courses/${courseId}/quizzes/${quizId}/questions`,
        method: 'POST',
        body: question,
      }),
      invalidatesTags: ['Quizzes'],
    }),
    updateQuestion: build.mutation<{ question: Question } & Message, QuizArg & { questionId: string; question: QuestionInput }>({
      query: ({ courseId, quizId, questionId, question }) => ({
        url: `/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`,
        method: 'PUT',
        body: question,
      }),
      invalidatesTags: ['Quizzes'],
    }),
    deleteQuestion: build.mutation<Message, QuizArg & { questionId: string }>({
      query: ({ courseId, quizId, questionId }) => ({
        url: `/courses/${courseId}/quizzes/${quizId}/questions/${questionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Quizzes'],
    }),
    // Instant, like the other reorder arrows (see contentApi).
    reorderQuestions: build.mutation<Message, QuizArg & { ids: string[] }>({
      query: ({ courseId, quizId, ids }) => ({
        url: `/courses/${courseId}/quizzes/${quizId}/questions/order`,
        method: 'PUT',
        body: { ids },
      }),
      async onQueryStarted({ courseId, quizId, ids }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          quizApi.util.updateQueryData('quizForEditing', { courseId, quizId }, (draft) => {
            draft.quiz.questions.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
          dispatch(quizApi.util.invalidateTags(['Quizzes']))
        }
      },
    }),
  }),
})

export const {
  useCourseQuizzesQuery,
  useCreateQuizMutation,
  useQuizForEditingQuery,
  useUpdateQuizMutation,
  useDeleteQuizMutation,
  useAddQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  useReorderQuestionsMutation,
} = quizApi
