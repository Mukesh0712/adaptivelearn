// "At-risk" students: simple, explainable rules. Each rule that applies
// adds a reason in plain words, so an instructor sees WHY a student is
// flagged ("Average quiz score 38% (pass mark 50%)"), not just a score.
//
//   low_scores      average of their best score per quiz < the pass mark
//   low_mastery     2 or more topics still "needs practice"
//   behind_lessons  finished fewer than half as many lessons as the
//                   class median (only once the class has done 2+)
//   inactive        nothing done in the course for 14 days or more
//   missed_due      graded quizzes not taken before their due date
//
// One reason → "watch"; two or more → "at risk".

export type RiskSignal = 'low_scores' | 'low_mastery' | 'behind_lessons' | 'inactive' | 'missed_due';
export type RiskLevel = 'at_risk' | 'watch' | 'ok';

export interface RiskInput {
  quizScores: { percent: number; passPercent: number }[]; // best attempt per quiz taken
  needsPracticeTopics: string[];
  lessonsDone: number;
  totalLessons: number;
  classMedianDone: number;
  lastActivity: Date;
  missedDue: string[]; // titles of graded quizzes missed
}

export interface RiskReason {
  signal: RiskSignal;
  text: string;
}

export const INACTIVE_DAYS = 14;
export const LOW_MASTERY_TOPICS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const list = (xs: string[], max = 3) => xs.slice(0, max).join(', ') + (xs.length > max ? ` and ${xs.length - max} more` : '');

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function assessRisk(input: RiskInput, now = new Date()): { level: RiskLevel; reasons: RiskReason[] } {
  const reasons: RiskReason[] = [];

  if (input.quizScores.length) {
    const avg = Math.round(mean(input.quizScores.map((q) => q.percent)));
    const pass = Math.round(mean(input.quizScores.map((q) => q.passPercent)));
    if (avg < pass) reasons.push({ signal: 'low_scores', text: `Average quiz score ${avg}% (pass mark ${pass}%)` });
  }

  const weak = input.needsPracticeTopics;
  if (weak.length >= LOW_MASTERY_TOPICS) {
    reasons.push({ signal: 'low_mastery', text: `${weak.length} topics need practice: ${list(weak)}` });
  }

  if (input.classMedianDone >= 2 && input.lessonsDone < input.classMedianDone / 2) {
    reasons.push({
      signal: 'behind_lessons',
      text: `Finished ${input.lessonsDone} of ${input.totalLessons} lessons (class median ${input.classMedianDone})`,
    });
  }

  const idle = Math.floor((now.getTime() - input.lastActivity.getTime()) / DAY_MS);
  if (idle >= INACTIVE_DAYS) reasons.push({ signal: 'inactive', text: `No activity in this course for ${idle} days` });

  if (input.missedDue.length) {
    const n = input.missedDue.length;
    reasons.push({ signal: 'missed_due', text: `Missed ${n} graded ${n === 1 ? 'quiz' : 'quizzes'}: ${list(input.missedDue)}` });
  }

  return { level: reasons.length >= 2 ? 'at_risk' : reasons.length === 1 ? 'watch' : 'ok', reasons };
}
