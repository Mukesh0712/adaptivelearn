import { baseApi } from '@/services/baseApi'
import type { ClassInsights, MyMastery } from './types'

export const adaptiveApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Recalculated by the server from quiz attempts and lesson progress, so
    // it refreshes whenever those change (a quiz submitted, a lesson marked
    // done): their mutations invalidate these tags.
    myMastery: build.query<MyMastery, string>({
      query: (courseId) => `/courses/${courseId}/mastery/me`,
      providesTags: ['Quizzes', 'Content', 'Courses'],
    }),
    // Instructor/admin: the whole class (heatmap + at-risk).
    classInsights: build.query<ClassInsights, string>({
      query: (courseId) => `/courses/${courseId}/insights`,
      providesTags: ['Quizzes', 'Content', 'Courses'],
    }),
  }),
})

export const { useMyMasteryQuery, useClassInsightsQuery } = adaptiveApi
