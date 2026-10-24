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
