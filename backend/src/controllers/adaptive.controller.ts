import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { ModuleModel } from '../models/Module.js';
import { QuizModel } from '../models/Quiz.js';
import { QuizAttemptModel } from '../models/QuizAttempt.js';
import { LessonProgressModel } from '../models/LessonProgress.js';
import { computeMastery, GENERAL_TOPIC, keyOf, type AttemptEvidence, type TopicMastery } from '../utils/mastery.js';
import { recommend, type RecLesson, type RecQuiz } from '../utils/recommend.js';
import { studentAccess } from './attempt.controller.js';
import { outline } from './content.controller.js';

// The adaptive learning engine: topic mastery (BKT), recommendations and
// at-risk students. Everything is calculated from the stored quiz attempts
// and lesson progress when asked, so it can never disagree with them.

// Submitted attempts in a course, grouped by student, as BKT evidence, plus
// the topic name for untagged questions of each quiz (its module title).
export async function courseEvidence(courseId: Types.ObjectId, studentIds?: string[]) {
  const [attempts, quizzes, modules] = await Promise.all([
    QuizAttemptModel.find({
      course: courseId,
      status: 'submitted',
      ...(studentIds ? { student: { $in: studentIds } } : {}),
    }).select('quiz student submittedAt questions.type questions.topic questions.options questions.points questions.earned'),
    QuizModel.find({ course: courseId }).select('module'),
    ModuleModel.find({ course: courseId }).select('title'),
  ]);

  const moduleTitle = new Map(modules.map((m) => [String(m._id), m.title]));
  const fallback = new Map(
    quizzes.map((q) => [String(q._id), (q.module && moduleTitle.get(String(q.module))) || GENERAL_TOPIC]),
  );

  const byStudent = new Map<string, AttemptEvidence[]>();
  for (const a of attempts) {
    const list = byStudent.get(String(a.student)) ?? [];
    list.push({
      quiz: String(a.quiz),
      submittedAt: a.submittedAt ?? new Date(0),
      questions: a.questions.map((q) => ({
        type: q.type,
        topic: q.topic,
        optionCount: q.options.length,
        points: q.points,
        earned: q.earned,
      })),
    });
    byStudent.set(String(a.student), list);
  }
  return { byStudent, fallback };
}

export const topicJson = (t: TopicMastery) => ({
  topic: t.topic,
  mastery: t.mastery,
  level: t.level,
  answered: t.answered,
  scorePercent: t.scorePercent,
  lastPracticed: t.lastPracticed,
});

// GET /api/courses/:courseId/mastery/me : the student's own mastery per
// topic, and "next steps" recommendations (utils/recommend.ts).
export async function myMastery(req: Request, res: Response) {
  const access = await studentAccess(req); // enrolled students only, else 403/404
  const courseId = access.course._id;
  const studentId = req.user!.id;
  const [{ byStudent, fallback }, modules, quizzes, open] = await Promise.all([
    courseEvidence(courseId, [studentId]),
    outline(courseId, true),
    QuizModel.find({ course: courseId, status: 'published' }).select('title module kind dueAt maxAttempts questions.topic'),
    // Attempts in progress whose time hasn't run out.
    QuizAttemptModel.find({
      course: courseId,
      student: studentId,
      status: 'in_progress',
      $or: [{ deadline: null }, { deadline: { $gt: new Date() } }],
    }).select('quiz'),
  ]);
  const evidence = byStudent.get(studentId) ?? [];
  const topics = computeMastery(evidence, fallback);

  const lessonList = modules.flatMap((m) => m.lessons.map((l) => ({ id: l.id, title: l.title, moduleId: m.id })));
  const done = new Set(
    (
      await LessonProgressModel.find({ student: studentId, lesson: { $in: lessonList.map((l) => l.id) } }).select('lesson')
    ).map((p) => String(p.lesson)),
  );
  const lessons: RecLesson[] = lessonList.map((l) => ({ ...l, done: done.has(l.id) }));
  const submitted = new Map<string, number>();
  for (const a of evidence) submitted.set(a.quiz, (submitted.get(a.quiz) ?? 0) + 1);
  const inProgress = new Set(open.map((a) => String(a.quiz)));
  const recQuizzes: RecQuiz[] = quizzes.map((q) => ({
    id: q.id,
    title: q.title,
    moduleId: q.module ? String(q.module) : null,
    kind: q.kind,
    dueAt: q.dueAt ?? null,
    maxAttempts: q.maxAttempts ?? null,
    // Same topic names as mastery: the tag, or the module for untagged.
    topicKeys: [...new Set(q.questions.map((x) => keyOf(x.topic?.trim() || fallback.get(q.id) || GENERAL_TOPIC)))],
    attemptsUsed: submitted.get(q.id) ?? 0,
    inProgress: inProgress.has(q.id),
  }));

  res.json({
    topics: topics.map(topicJson),
    nextSteps: recommend(lessons, recQuizzes, topics),
    summary: {
      mastered: topics.filter((t) => t.level === 'mastered').length,
      learning: topics.filter((t) => t.level === 'learning').length,
      needsPractice: topics.filter((t) => t.level === 'needs_practice').length,
    },
  });
}
