// Shapes returned by backend/src/controllers/quiz.controller.ts.

export type QuestionType = 'single' | 'multiple' | 'true_false' | 'short'
export type QuizKind = 'practice' | 'graded'
export type RevealMode = 'auto' | 'immediately' | 'after_due' | 'never'

export const MAX_QUESTIONS = 100

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single: 'Single choice',
  multiple: 'Multiple select',
  true_false: 'True / False',
  short: 'Short answer',
}

export const REVEAL_LABEL: Record<RevealMode, string> = {
  auto: 'Automatic',
  immediately: 'Right after submitting',
  after_due: 'After the due date',
  never: 'Never (score only)',
}

export interface QuizOption {
  id: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  text: string
  points: number
  topic: string
  explanation: string
  options: QuizOption[]
  correctOptions: string[] // option ids
  partialCredit?: boolean
  correctBool?: boolean
  answerMode?: 'text' | 'number'
  acceptedAnswers?: string[]
  numericAnswer?: number
  tolerance?: number
}

export interface Quiz {
  id: string
  course: string
  module: string | null // null: a course test
  title: string
  instructions: string
  kind: QuizKind
  timeLimitMinutes: number | null
  maxAttempts: number | null
  passPercent: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  dueAt: string | null
  reveal: RevealMode
  status: 'draft' | 'published'
  publishedAt: string | null
  questions: Question[]
  totalPoints: number
}

export interface QuizSummary {
  id: string
  title: string
  module: string | null
  moduleTitle: string | null
  kind: QuizKind
  status: 'draft' | 'published'
  dueAt: string | null
  timeLimitMinutes: number | null
  questionCount: number
  totalPoints: number
}

export interface QuizEditorData {
  quiz: Quiz
  course: { id: string; title: string }
  modules: { id: string; title: string }[]
  topics: string[]
  publishProblems: string[]
}

export type QuizSettings = Partial<{
  title: string
  instructions: string
  module: string | null
  kind: QuizKind
  timeLimitMinutes: number | null
  maxAttempts: number | null
  passPercent: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  dueAt: string | null
  reveal: RevealMode
  status: 'draft' | 'published'
}>

// What the question form sends (see backend validators/quiz.schema.ts).
export type QuestionInput = {
  text: string
  points: number
  topic: string
  explanation: string
} & (
  | { type: 'single'; options: string[]; correct: number[] }
  | { type: 'multiple'; options: string[]; correct: number[]; partialCredit: boolean }
  | { type: 'true_false'; correctBool: boolean }
  | { type: 'short'; answerMode: 'text'; acceptedAnswers: string[] }
  | { type: 'short'; answerMode: 'number'; numericAnswer: number; tolerance: number }
)
