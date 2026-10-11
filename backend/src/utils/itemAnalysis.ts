// Classical item analysis of one quiz, from each student's FIRST submitted
// attempt (later attempts are influenced by having seen the questions).
//
//  - difficulty p: the average share of the marks students got on the
//    question (0 = nobody right, 1 = everyone right);
//  - discrimination D: p in the top 27% of students (by total score) minus
//    p in the bottom 27%. Good questions: D ≥ 0.3. Near 0: it doesn't
//    separate strong and weak students. Negative: strong students got it
//    wrong more often, which usually means the answer key is wrong.
//  - for choice questions, how often each option was chosen (a popular
//    wrong option points to a common misconception).
import { normalise } from './quizGrading.js';

type Id = { toString(): string };
export interface AnalysedAttempt {
  percent: number;
  questions: {
    questionId: Id;
    type: string;
    text: string;
    points: number;
    topic?: string | null;
    options: { _id: Id; text?: string | null }[];
    correctOptions: Id[];
    correctBool?: boolean | null;
    selected: Id[];
    answerBool?: boolean | null;
    answerText?: string | null;
    earned: number;
    correct: string;
  }[];
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function analyseItems(attempts: AnalysedAttempt[]) {
  const n = attempts.length;
  // Top and bottom groups (27% each, at least 1 student) by total score.
  const ranked = [...attempts].sort((a, b) => b.percent - a.percent);
  const k = Math.max(1, Math.round(n * 0.27));
  const upper = new Set(ranked.slice(0, k));
  const lower = new Set(ranked.slice(-k));
  const canDiscriminate = n >= 4; // too few students: D would mean nothing

  // Question id → everything about it, in the order first seen.
  const items = new Map<string, { q: AnalysedAttempt['questions'][number]; rows: { a: AnalysedAttempt; q: AnalysedAttempt['questions'][number] }[] }>();
  for (const a of attempts) {
    for (const q of a.questions) {
      const key = String(q.questionId);
      if (!items.has(key)) items.set(key, { q, rows: [] });
      items.get(key)!.rows.push({ a, q });
    }
  }

  return [...items.entries()].map(([id, { q, rows }]) => {
    const score = (r: (typeof rows)[number]) => (r.q.points ? r.q.earned / r.q.points : 0);
    const mean = (rs: typeof rows) => (rs.length ? rs.reduce((s, r) => s + score(r), 0) / rs.length : 0);
    const p = mean(rows);
    const d = canDiscriminate ? mean(rows.filter((r) => upper.has(r.a))) - mean(rows.filter((r) => lower.has(r.a))) : null;

    let choices: { label: string; count: number; correct: boolean }[] = [];
    if (q.type === 'single' || q.type === 'multiple') {
      const right = new Set(q.correctOptions.map(String));
      choices = q.options.map((o) => ({
        label: o.text ?? '',
        count: rows.filter((r) => r.q.selected.map(String).includes(String(o._id))).length,
        correct: right.has(String(o._id)),
      }));
    } else if (q.type === 'true_false') {
      choices = [true, false].map((v) => ({
        label: v ? 'True' : 'False',
        count: rows.filter((r) => r.q.answerBool === v).length,
        correct: q.correctBool === v,
      }));
    } else {
      // Short answers: the most common WRONG answers.
      const wrong = new Map<string, number>();
      for (const r of rows) {
        if (r.q.correct === 'wrong' && r.q.answerText?.trim()) {
          const key = normalise(r.q.answerText);
          wrong.set(key, (wrong.get(key) ?? 0) + 1);
        }
      }
      choices = [...wrong.entries()]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count, correct: false }));
    }

    const flags: string[] = [];
    if (rows.length >= 5) {
      if (p < 0.3) flags.push('very_hard');
      if (p > 0.9) flags.push('very_easy');
    }
    if (d !== null && d < 0) flags.push('negative_discrimination');
    else if (d !== null && d < 0.2 && p > 0 && p < 1) flags.push('low_discrimination');

    return {
      questionId: id,
      type: q.type,
      text: q.text,
      points: q.points,
      topic: q.topic ?? '',
      responses: rows.length,
      unanswered: rows.filter((r) => r.q.correct === 'unanswered').length,
      correct: rows.filter((r) => r.q.correct === 'correct').length,
      difficulty: round(p),
      discrimination: d === null ? null : round(d),
      choices,
      flags,
    };
  });
}
