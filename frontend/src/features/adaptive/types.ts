// Adaptive learning (backend: adaptive.controller.ts, utils/bkt.ts,
// utils/recommend.ts).

export type MasteryLevel = 'mastered' | 'learning' | 'needs_practice'

export interface TopicMastery {
  topic: string
  mastery: number // 0..1: the estimated chance the student has learned it
  level: MasteryLevel
  answered: number
  scorePercent: number
  lastPracticed: string
}

export type NextStepKind = 'finish_quiz' | 'due_quiz' | 'review_lesson' | 'practice_quiz' | 'next_lesson' | 'new_quiz'

export interface NextStep {
  kind: NextStepKind
  target: { type: 'lesson' | 'quiz'; id: string; title: string }
  topic?: string
  level?: MasteryLevel
  dueAt?: string
}

export interface MyMastery {
  topics: TopicMastery[]
  nextSteps: NextStep[]
  summary: { mastered: number; learning: number; needsPractice: number }
}

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  mastered: 'Mastered',
  learning: 'Learning',
  needs_practice: 'Needs practice',
}

// ---- Instructor: class insights (GET /courses/:courseId/insights) ----

export type RiskLevel = 'at_risk' | 'watch' | 'ok'
export type RiskSignal = 'low_scores' | 'low_mastery' | 'behind_lessons' | 'inactive' | 'missed_due'

export interface InsightStudent {
  id: string
  name: string
  email: string
  lessonsDone: number
  quizzesTaken: number
  averageScore: number | null
  lastActivity: string
  // Keyed by topic key (see InsightTopic.key). Missing: not answered yet.
  topics: Record<string, { mastery: number; level: MasteryLevel; answered: number }>
  risk: { level: RiskLevel; reasons: { signal: RiskSignal; text: string }[] }
}

export interface InsightTopic {
  key: string
  topic: string
  students: number // how many students have answered it
  average: number // class average mastery, 0..1
  needsPractice: number
  mastered: number
}

export interface ClassInsights {
  topics: InsightTopic[] // hardest for the class first
  students: InsightStudent[] // at risk, then watch, then ok
  summary: { students: number; lessons: number; atRisk: number; watch: number }
}
