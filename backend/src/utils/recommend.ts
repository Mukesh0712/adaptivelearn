import type { MasteryLevel } from './bkt.js';
import { keyOf } from './mastery.js';

// "Next steps" for a student: a short, ordered list of what to do next,
// from their topic mastery, lesson progress and quizzes. Plain rules, in
// priority order, so every suggestion can be explained:
//
//   1. finish_quiz    an attempt is in progress
//   2. due_quiz       a quiz is due within 7 days and not taken yet
//   3. review_lesson  a weak topic: re-read a lesson of the module it's from
//                     (one named after the topic if there is one)
//      practice_quiz  …and practise it in a quiz that's still open
//   4. next_lesson    the first lesson not done yet, in course order
//   5. new_quiz       a quiz not taken yet whose module's lessons are done
//
// Weak topics are "needs practice" ones first, then "learning", weakest
// first, at most two. Each target appears once; at most five steps.

export interface RecLesson {
  id: string;
  title: string;
  moduleId: string;
  done: boolean;
}

export interface RecQuiz {
  id: string;
  title: string;
  moduleId: string | null;
  kind: string; // practice | graded
  dueAt: Date | null;
  maxAttempts: number | null;
  topicKeys: string[]; // topics its questions test (grouping keys)
  attemptsUsed: number; // submitted
  inProgress: boolean;
}

export interface RecTopic {
  key: string;
  topic: string;
  level: MasteryLevel;
  mastery: number;
}

export type NextStepKind = 'finish_quiz' | 'due_quiz' | 'review_lesson' | 'practice_quiz' | 'next_lesson' | 'new_quiz';

export interface NextStep {
  kind: NextStepKind;
  target: { type: 'lesson' | 'quiz'; id: string; title: string };
  topic?: string; // the weak topic, for review/practice steps
  level?: MasteryLevel;
  dueAt?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_STEPS = 5;
const MAX_WEAK_TOPICS = 2;

// Can the student start a new attempt now?
const canStart = (q: RecQuiz, now: Date) =>
  !(q.dueAt && now.getTime() > q.dueAt.getTime()) && !(q.maxAttempts && q.attemptsUsed >= q.maxAttempts);

export function recommend(lessons: RecLesson[], quizzes: RecQuiz[], topics: RecTopic[], now = new Date()): NextStep[] {
  const steps: NextStep[] = [];
  const used = new Set<string>();
  const add = (step: NextStep) => {
    if (steps.length >= MAX_STEPS || used.has(step.target.id)) return;
    used.add(step.target.id);
    steps.push(step);
  };
  const quizTarget = (q: RecQuiz) => ({ type: 'quiz' as const, id: q.id, title: q.title });
  const lessonTarget = (l: RecLesson) => ({ type: 'lesson' as const, id: l.id, title: l.title });

  // 1. Unfinished attempts.
  for (const q of quizzes) if (q.inProgress) add({ kind: 'finish_quiz', target: quizTarget(q) });

  // 2. Due within a week, not taken yet (soonest first).
  quizzes
    .filter((q) => q.dueAt && !q.attemptsUsed && !q.inProgress && canStart(q, now) && q.dueAt.getTime() - now.getTime() <= 7 * DAY_MS)
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
    .forEach((q) => add({ kind: 'due_quiz', target: quizTarget(q), dueAt: q.dueAt! }));

  // 3. Weak topics.
  const weak = topics
    .filter((t) => t.level !== 'mastered')
    .sort((a, b) => Number(b.level === 'needs_practice') - Number(a.level === 'needs_practice') || a.mastery - b.mastery)
    .slice(0, MAX_WEAK_TOPICS);
  for (const t of weak) {
    const testing = quizzes.filter((q) => q.topicKeys.includes(t.key));
    const modules = new Set(testing.flatMap((q) => (q.moduleId ? [q.moduleId] : [])));
    const inModules = lessons.filter((l) => modules.has(l.moduleId));
    // A lesson named after the topic ("Queues" for topic "queues"), else the
    // first one not done yet, else the first.
    const lesson =
      inModules.find((l) => keyOf(l.title).includes(t.key) || t.key.includes(keyOf(l.title))) ??
      inModules.find((l) => !l.done) ??
      inModules[0];
    if (lesson) add({ kind: 'review_lesson', target: lessonTarget(lesson), topic: t.topic, level: t.level });
    // Practice quizzes first: they're meant for retrying.
    const quiz = testing
      .filter((q) => canStart(q, now) && !q.inProgress)
      .sort((a, b) => Number(b.kind === 'practice') - Number(a.kind === 'practice'))[0];
    if (quiz) add({ kind: 'practice_quiz', target: quizTarget(quiz), topic: t.topic, level: t.level });
  }

  // 4. Keep going through the course.
  const nextLesson = lessons.find((l) => !l.done);
  if (nextLesson) add({ kind: 'next_lesson', target: lessonTarget(nextLesson) });

  // 5. Quizzes ready to take: never attempted, and the lessons before them
  //    (their module's, or the whole course's for a course test) are done.
  for (const q of quizzes) {
    if (q.attemptsUsed || q.inProgress || !canStart(q, now)) continue;
    const before = q.moduleId ? lessons.filter((l) => l.moduleId === q.moduleId) : lessons;
    if (before.every((l) => l.done)) add({ kind: 'new_quiz', target: quizTarget(q) });
  }

  return steps;
}
