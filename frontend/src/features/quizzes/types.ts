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
  studentsTaken?: number
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

// ---- Student side (backend/src/controllers/attempt.controller.ts) ----

export interface AttemptSummary {
  id: string
  number: number
  status: 'in_progress' | 'submitted'
  startedAt: string
  submittedAt: string | null
  score: number | null
  maxScore: number
  percent: number | null
  passed: boolean | null
}

export interface QuizOverview {
  quiz: {
    id: string
    title: string
    instructions: string
    kind: QuizKind
    timeLimitMinutes: number | null
    maxAttempts: number | null
    passPercent: number
    dueAt: string | null
    questionCount: number
    totalPoints: number
  }
  course: { id: string; title: string }
  attempts: AttemptSummary[]
  bestPercent: number | null
  inProgressId: string | null
  cannotStart: string | null // why a new attempt can't start, or null
}

export interface StudentAnswer {
  selected: string[]
  bool: boolean | null
  text: string
}

export type Verdict = 'correct' | 'partial' | 'wrong' | 'unanswered'

export interface AttemptQuestion {
  id: string
  type: QuestionType
  text: string
  points: number
  answerMode?: 'text' | 'number'
  options: QuizOption[]
  answer: StudentAnswer
  // Only after submitting, and only when answers are revealed:
  earned?: number
  verdict?: Verdict
  explanation?: string
  correctOptions?: string[]
  correctBool?: boolean
  acceptedAnswers?: string[]
  numericAnswer?: number
  tolerance?: number
}

export interface Attempt {
  id: string
  number: number
  status: 'in_progress' | 'submitted'
  startedAt: string
  deadline?: string | null
  serverNow?: string
  submittedAt?: string | null
  autoSubmitted?: boolean
  score?: number
  maxScore?: number
  percent?: number
  passed?: boolean
  passPercent?: number
  revealed?: boolean
  revealHint?: string
  questions: AttemptQuestion[]
}

// A quiz in the student's course outline.
export interface StudentQuizItem {
  id: string
  title: string
  module: string | null
  kind: QuizKind
  dueAt: string | null
  timeLimitMinutes: number | null
  questionCount: number
  attempts: number
  inProgress: boolean
  bestPercent: number | null
}

// ---- Instructor results (quizResults / reviewAttempt) ----

export type ItemFlag = 'very_hard' | 'very_easy' | 'negative_discrimination' | 'low_discrimination'

export interface ItemAnalysis {
  questionId: string
  type: QuestionType
  text: string
  points: number
  topic: string
  responses: number
  unanswered: number
  correct: number
  difficulty: number // 0-1: average share of marks
  discrimination: number | null // -1..1; null with fewer than 4 students
  choices: { label: string; count: number; correct: boolean }[]
  flags: ItemFlag[]
}

export interface GradebookRow {
  id: string
  name: string
  email: string
  enrolled: boolean
  attempts: number
  inProgress: boolean
  bestPercent: number | null
  passed: boolean | null
  lastSubmittedAt: string | null
  latestAttemptId: string | null
  attemptIds: { id: string; number: number; percent: number }[]
}

export interface QuizResults {
  quiz: { id: string; title: string; kind: QuizKind; passPercent: number; status: 'draft' | 'published' }
  course: { id: string; title: string }
  stats: {
    enrolled: number
    attempted: number
    submittedAttempts: number
    inProgress: number
    averageBest: number | null
    averageFirst: number | null
    passRate: number | null
  }
  students: GradebookRow[]
  items: ItemAnalysis[]
  itemBase: number // how many first attempts the analysis is based on
}

export interface AttemptReviewData {
  quiz: { id: string; title: string }
  student: { id: string; name: string; email: string }
  attempt: Attempt & { answered?: number; total?: number }
}
