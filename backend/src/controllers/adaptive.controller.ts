import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { ModuleModel } from '../models/Module.js';
import { QuizModel } from '../models/Quiz.js';
import { QuizAttemptModel } from '../models/QuizAttempt.js';
import { LessonProgressModel } from '../models/LessonProgress.js';
import { EnrollmentModel } from '../models/Enrollment.js';
import { LessonModel } from '../models/Lesson.js';
import { assessRisk, median } from '../utils/risk.js';
import { computeMastery, GENERAL_TOPIC, keyOf, type AttemptEvidence, type TopicMastery } from '../utils/mastery.js';
import { recommend, type RecLesson, type RecQuiz } from '../utils/recommend.js';
import { studentAccess } from './attempt.controller.js';
import { editAccess, outline } from './content.controller.js';

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

// GET /api/courses/:courseId/insights : the class view for the course's
// instructor (or an admin). Every enrolled student with their mastery per
// topic (the heatmap) and their risk level with reasons.
export async function classInsights(req: Request, res: Response) {
  const access = await editAccess(req); // instructor of this course or admin, else 403/404
  const courseId = access.course._id;
  const now = new Date();

  const enrollments = await EnrollmentModel.find({ course: courseId }).populate<{
    student: { _id: Types.ObjectId; name: string; email: string } | null;
  }>('student', 'name email');
  const students = enrollments.filter((e) => e.student);
  const ids = students.map((e) => String(e.student!._id));

  const [{ byStudent, fallback }, lessons, progress, attempts, pastDue] = await Promise.all([
    courseEvidence(courseId, ids),
    LessonModel.find({ course: courseId, status: 'published' }).select('_id'),
    LessonProgressModel.find({ course: courseId, student: { $in: ids } }).select('student lesson completedAt'),
    QuizAttemptModel.find({ course: courseId, student: { $in: ids } }).select(
      'quiz student status percent passPercent startedAt submittedAt',
    ),
    // Graded quizzes whose due date has passed: anyone who didn't submit one missed it.
    QuizModel.find({ course: courseId, status: 'published', kind: 'graded', dueAt: { $lt: now } }).select('title dueAt'),
  ]);

  const published = new Set(lessons.map((l) => String(l._id)));
  const doneBy = new Map<string, number>();
  const lastActive = new Map<string, number>();
  const touch = (id: string, d?: Date | null) => {
    if (d) lastActive.set(id, Math.max(lastActive.get(id) ?? 0, d.getTime()));
  };
  for (const p of progress) {
    const id = String(p.student);
    if (published.has(String(p.lesson))) doneBy.set(id, (doneBy.get(id) ?? 0) + 1);
    touch(id, p.completedAt);
  }
  // Best score per (student, quiz), and which quizzes each student submitted.
  const best = new Map<string, Map<string, { percent: number; passPercent: number }>>();
  for (const a of attempts) {
    const id = String(a.student);
    touch(id, a.startedAt);
    touch(id, a.submittedAt);
    if (a.status !== 'submitted') continue;
    const mine = best.get(id) ?? new Map();
    const prev = mine.get(String(a.quiz));
    if (!prev || a.percent > prev.percent) mine.set(String(a.quiz), { percent: a.percent, passPercent: a.passPercent });
    best.set(id, mine);
  }
  const classMedianDone = median(ids.map((id) => doneBy.get(id) ?? 0));

  const rows = students.map((e) => {
    const s = e.student!;
    const id = String(s._id);
    touch(id, e.joinedAt);
    const topics = computeMastery(byStudent.get(id) ?? [], fallback);
    const scores = [...(best.get(id)?.values() ?? [])];
    // Missed: due after they joined (they had the chance) and not submitted.
    const missed = pastDue.filter((q) => q.dueAt! > e.joinedAt && !best.get(id)?.has(q.id)).map((q) => q.title);
    const risk = assessRisk(
      {
        quizScores: scores,
        needsPracticeTopics: topics.filter((t) => t.level === 'needs_practice').map((t) => t.topic),
        lessonsDone: doneBy.get(id) ?? 0,
        totalLessons: published.size,
        classMedianDone,
        lastActivity: new Date(lastActive.get(id) ?? e.joinedAt.getTime()),
        missedDue: missed,
      },
      now,
    );
    return {
      id,
      name: s.name,
      email: s.email,
      lessonsDone: doneBy.get(id) ?? 0,
      quizzesTaken: scores.length,
      averageScore: scores.length ? Math.round(scores.reduce((n, x) => n + x.percent, 0) / scores.length) : null,
      lastActivity: new Date(lastActive.get(id) ?? e.joinedAt.getTime()),
      topics: Object.fromEntries(topics.map((t) => [t.key, { mastery: t.mastery, level: t.level, answered: t.answered }])),
      risk,
      names: topics.map((t) => [t.key, t.topic] as const),
    };
  });

  // Columns of the heatmap: every topic anyone has answered, the one the
  // class finds hardest (lowest average mastery) first.
  const topicNames = new Map<string, string>();
  for (const r of rows) for (const [k, n] of r.names) if (!topicNames.has(k)) topicNames.set(k, n);
  const columns = [...topicNames].map(([key, topic]) => {
    const values = rows.flatMap((r) => (r.topics[key] ? [r.topics[key]!] : []));
    return {
      key,
      topic,
      students: values.length,
      average: Math.round((values.reduce((n, v) => n + v.mastery, 0) / values.length) * 1000) / 1000,
      needsPractice: values.filter((v) => v.level === 'needs_practice').length,
      mastered: values.filter((v) => v.level === 'mastered').length,
    };
  });
  columns.sort((a, b) => a.average - b.average || a.topic.localeCompare(b.topic));

  const order = { at_risk: 0, watch: 1, ok: 2 } as const;
  res.json({
    topics: columns,
    students: rows
      .map(({ names: _names, ...r }) => r)
      .sort((a, b) => order[a.risk.level] - order[b.risk.level] || a.name.localeCompare(b.name)),
    summary: {
      students: rows.length,
      lessons: published.size,
      atRisk: rows.filter((r) => r.risk.level === 'at_risk').length,
      watch: rows.filter((r) => r.risk.level === 'watch').length,
    },
  });
}
