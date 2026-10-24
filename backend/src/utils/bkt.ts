// Bayesian Knowledge Tracing (BKT): estimates the probability that a
// student has LEARNED a topic, from their answers so far.
//
// For each topic the model keeps one number, p = P(the student knows it).
// After every answer it does two things:
//
//   1. Evidence (Bayes' rule). A student who knows the topic still slips
//      sometimes; one who doesn't can still guess right. So a correct
//      answer raises p, a wrong one lowers it, by how surprising it is:
//        P(knows | correct) = p(1 - slip) / [ p(1 - slip) + (1 - p) guess ]
//        P(knows | wrong)   = p slip      / [ p slip      + (1 - p)(1 - guess) ]
//
//   2. Learning. Answering (and seeing the feedback) is itself practice, so
//      a student who didn't know it may have learned it now:
//        p' = p + (1 - p) learn
//
// Reference: Corbett & Anderson (1995), "Knowledge tracing: Modeling the
// acquisition of procedural knowledge".

export interface BktParams {
  init: number; // P(knows it) before any answer
  learn: number; // P(learns it from one practice opportunity)
  slip: number; // P(wrong answer although they know it)
  guess: number; // P(right answer although they don't know it)
}

// Standard starting values from the BKT literature. (A research system
// would fit them to past data per topic; there isn't enough data for that
// in one class, so fixed, explainable values are used.)
export const DEFAULT_BKT: BktParams = { init: 0.2, learn: 0.15, slip: 0.1, guess: 0.2 };

// How easy it is to guess, by question type: 1 of 2 for true/false, 1 of
// n options for single choice, much harder for "select all" and typed
// answers. Capped below 0.5: if guessing were as likely as knowing, a
// right answer would carry no evidence at all.
export function guessFor(type: string, optionCount = 0): number {
  const g =
    type === 'true_false'
      ? 0.5
      : type === 'single'
        ? 1 / Math.max(2, optionCount)
        : type === 'multiple'
          ? 0.1
          : 0.05; // short answer
  return Math.min(g, 0.45);
}

// One answer. `score` is the share of the points earned, 0 to 1: partial
// credit counts as that much "correct" evidence and the rest as "wrong".
export function bktUpdate(p: number, score: number, params: BktParams): number {
  const s = Math.min(1, Math.max(0, score));
  const { slip, guess, learn } = params;
  const ifCorrect = (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess);
  const ifWrong = (p * slip) / (p * slip + (1 - p) * (1 - guess));
  const evidence = s * ifCorrect + (1 - s) * ifWrong;
  return evidence + (1 - evidence) * learn;
}

// Mastery levels shown to people. 0.95 is the usual BKT "mastered"
// threshold; below 0.4 the student most likely hasn't learned it yet.
export type MasteryLevel = 'mastered' | 'learning' | 'needs_practice';
export const MASTERED_AT = 0.95;
export const NEEDS_PRACTICE_BELOW = 0.4;

export function masteryLevel(p: number): MasteryLevel {
  if (p >= MASTERED_AT) return 'mastered';
  if (p < NEEDS_PRACTICE_BELOW) return 'needs_practice';
  return 'learning';
}
