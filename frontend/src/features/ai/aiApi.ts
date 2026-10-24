import { baseApi } from '@/services/baseApi'
import type { QuestionInput } from '@/features/quizzes/types'

// AI features (backend: ai.controller.ts, aiTools.controller.ts).
// Every AI request updates the "left today" count, hence the 'Ai' tag.

export type AiMe = { enabled: boolean; limit: number; left: number }
export type ChatTurn = { role: 'student' | 'assistant'; text: string }
export type DraftQuestionType = 'single' | 'multiple' | 'true_false' | 'short'
export type GenerateQuestionsRequest = {
  courseId: string
  quizId: string
  lessonId: string
  count: number
  types: DraftQuestionType[]
  difficulty: 'easy' | 'medium' | 'hard'
}

export const aiApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Can I use AI here, and how many requests are left today?
    aiMe: build.query<AiMe, void>({
      query: () => '/ai/me',
      providesTags: ['Ai'],
    }),
    summarizeLesson: build.mutation<{ summary: string; left: number }, { courseId: string; lessonId: string }>({
      query: ({ courseId, lessonId }) => ({ url: `/courses/${courseId}/lessons/${lessonId}/ai/summary`, method: 'POST' }),
      invalidatesTags: ['Ai'],
    }),
    generateQuestions: build.mutation<
      { questions: QuestionInput[]; dropped: number; left: number },
      GenerateQuestionsRequest
    >({
      query: ({ courseId, quizId, ...body }) => ({
        url: `/courses/${courseId}/quizzes/${quizId}/ai/questions`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Ai'],
    }),
    // Study assistant: one question about a lesson. history: the last few
    // messages (the chat lives only in the browser).
    lessonChat: build.mutation<
      { answer: string; left: number },
      { courseId: string; lessonId: string; question: string; history: ChatTurn[] }
    >({
      query: ({ courseId, lessonId, ...body }) => ({
        url: `/courses/${courseId}/lessons/${lessonId}/ai/chat`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Ai'],
    }),
  }),
})

export const { useAiMeQuery, useSummarizeLessonMutation, useGenerateQuestionsMutation, useLessonChatMutation } = aiApi
