import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { ModuleModel } from '../models/Module.js';
import { QuizModel } from '../models/Quiz.js';
import { QuizAttemptModel } from '../models/QuizAttempt.js';
import { computeMastery, GENERAL_TOPIC, type AttemptEvidence, type TopicMastery } from '../utils/mastery.js';
import { studentAccess } from './attempt.controller.js';

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

// GET /api/courses/:courseId/mastery/me : the student's own mastery per topic.
export async function myMastery(req: Request, res: Response) {
  const access = await studentAccess(req); // enrolled students only, else 403/404
  const { byStudent, fallback } = await courseEvidence(access.course._id, [req.user!.id]);
  const topics = computeMastery(byStudent.get(req.user!.id) ?? [], fallback);
  res.json({
    topics: topics.map(topicJson),
    summary: {
      mastered: topics.filter((t) => t.level === 'mastered').length,
      learning: topics.filter((t) => t.level === 'learning').length,
      needsPractice: topics.filter((t) => t.level === 'needs_practice').length,
    },
  });
}
