// Automatic marking. Runs only on the server, on the snapshot stored with
// the attempt.

type Id = { toString(): string };
export interface Gradable {
  type: string;
  points: number;
  correctOptions: Id[];
  partialCredit?: boolean | null;
  correctBool?: boolean | null;
  answerMode?: string | null;
  acceptedAnswers: string[];
  numericAnswer?: number | null;
  tolerance?: number | null;
  selected: Id[];
  answerBool?: boolean | null;
  answerText?: string | null;
}

export type Verdict = 'correct' | 'partial' | 'wrong' | 'unanswered';

// "  A   Stack " → "a stack": answers match ignoring case and extra spaces.
export const normalise = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

// "3.14", " 3,14 " (comma as decimal mark), "1e3". null if not a number.
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function gradeQuestion(q: Gradable): { earned: number; verdict: Verdict } {
  const picked = new Set(q.selected.map(String));
  const right = new Set(q.correctOptions.map(String));
  switch (q.type) {
    case 'single': {
      if (picked.size === 0) return { earned: 0, verdict: 'unanswered' };
      const ok = picked.size === 1 && right.has([...picked][0]!);
      return { earned: ok ? q.points : 0, verdict: ok ? 'correct' : 'wrong' };
    }
    case 'multiple': {
      if (picked.size === 0) return { earned: 0, verdict: 'unanswered' };
      const hits = [...picked].filter((id) => right.has(id)).length;
      const misses = picked.size - hits;
      if (hits === right.size && misses === 0) return { earned: q.points, verdict: 'correct' };
      if (!q.partialCredit) return { earned: 0, verdict: 'wrong' };
      // Each right choice earns a share; each wrong choice takes one back.
      const earned = round2((q.points * Math.max(0, hits - misses)) / right.size);
      return { earned, verdict: earned > 0 ? 'partial' : 'wrong' };
    }
    case 'true_false': {
      if (q.answerBool === null || q.answerBool === undefined) return { earned: 0, verdict: 'unanswered' };
      const ok = q.answerBool === q.correctBool;
      return { earned: ok ? q.points : 0, verdict: ok ? 'correct' : 'wrong' };
    }
    case 'short': {
      const text = q.answerText ?? '';
      if (!text.trim()) return { earned: 0, verdict: 'unanswered' };
      let ok: boolean;
      if (q.answerMode === 'number') {
        const n = parseNumber(text);
        // A tiny epsilon so 0.1 + 0.2 style rounding never fails a right answer.
        ok = n !== null && Math.abs(n - (q.numericAnswer ?? NaN)) <= (q.tolerance ?? 0) + 1e-9;
      } else {
        ok = q.acceptedAnswers.map(normalise).includes(normalise(text));
      }
      return { earned: ok ? q.points : 0, verdict: ok ? 'correct' : 'wrong' };
    }
    default:
      return { earned: 0, verdict: 'unanswered' };
  }
}
