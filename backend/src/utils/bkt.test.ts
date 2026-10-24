// Run: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bktUpdate, DEFAULT_BKT, guessFor, masteryLevel } from './bkt.js';
import { computeMastery, type AttemptEvidence } from './mastery.js';

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const P = { ...DEFAULT_BKT, guess: 0.25 };

describe('bktUpdate', () => {
  it('matches a hand-worked example (correct answer from 0.2)', () => {
    // evidence: 0.2·0.9 / (0.2·0.9 + 0.8·0.25) = 0.18 / 0.38 = 0.4737
    // learning: 0.4737 + 0.5263·0.15 = 0.5526
    close(bktUpdate(0.2, 1, P), 0.5526);
  });

  it('matches a hand-worked example (wrong answer from 0.2)', () => {
    // evidence: 0.2·0.1 / (0.2·0.1 + 0.8·0.75) = 0.02 / 0.62 = 0.0323
    // learning: 0.0323 + 0.9677·0.15 = 0.1774
    close(bktUpdate(0.2, 0, P), 0.1774);
  });

  it('three correct answers in a row reach "mastered"', () => {
    let p = P.init;
    for (let i = 0; i < 3; i++) p = bktUpdate(p, 1, P);
    assert.equal(masteryLevel(p), 'mastered');
  });

  it('right answers raise it, wrong ones lower it, partial is in between', () => {
    const right = bktUpdate(0.5, 1, P);
    const wrong = bktUpdate(0.5, 0, P);
    const half = bktUpdate(0.5, 0.5, P);
    assert.ok(right > 0.5 && wrong < right && half > wrong && half < right);
  });

  it('always stays a probability', () => {
    for (const p of [0, 0.001, 0.5, 0.999, 1]) {
      for (const s of [-1, 0, 0.3, 1, 2]) {
        const r = bktUpdate(p, s, P);
        assert.ok(r >= 0 && r <= 1 && Number.isFinite(r), `p=${p} s=${s} → ${r}`);
      }
    }
  });

  it('an easy-to-guess right answer counts for less', () => {
    const tf = bktUpdate(0.2, 1, { ...P, guess: guessFor('true_false') });
    const short = bktUpdate(0.2, 1, { ...P, guess: guessFor('short') });
    assert.ok(short > tf);
  });
});

describe('guessFor', () => {
  it('depends on the question type, capped below 0.5', () => {
    assert.equal(guessFor('true_false'), 0.45);
    close(guessFor('single', 4), 0.25);
    assert.equal(guessFor('single', 2), 0.45);
    assert.equal(guessFor('multiple'), 0.1);
    assert.equal(guessFor('short'), 0.05);
  });
});

describe('computeMastery', () => {
  const q = (topic: string | null, earned: number, type = 'single') => ({ type, topic, optionCount: 4, points: 1, earned });
  const at = (quiz: string, day: number, questions: AttemptEvidence['questions']) => ({
    quiz,
    submittedAt: new Date(Date.UTC(2026, 9, day)),
    questions,
  });
  const fallback = new Map([['quiz1', 'Linear structures']]);

  it('groups tags ignoring case and spaces, and untagged by module', () => {
    const topics = computeMastery([at('quiz1', 1, [q('Arrays', 1), q(' arrays ', 1), q('', 0), q(null, 1)])], fallback);
    assert.deepEqual(
      topics.map((t) => [t.topic, t.answered]).sort(),
      [
        ['Arrays', 2],
        ['Linear structures', 2],
      ],
    );
  });

  it('course tests without a module fall back to "General"', () => {
    assert.equal(computeMastery([at('test9', 1, [q(null, 1)])], fallback)[0]!.topic, 'General');
  });

  it('replays attempts in the order they were submitted', () => {
    // Wrong first then right, versus right first then wrong: BKT ends
    // higher when the student got it right most recently.
    const improving = computeMastery([at('quiz1', 2, [q('Stacks', 1)]), at('quiz1', 1, [q('Stacks', 0)])], fallback)[0]!;
    const declining = computeMastery([at('quiz1', 1, [q('Stacks', 1)]), at('quiz1', 2, [q('Stacks', 0)])], fallback)[0]!;
    assert.ok(improving.mastery > declining.mastery);
    assert.equal(improving.scorePercent, 50);
    assert.deepEqual(improving.lastPracticed, new Date(Date.UTC(2026, 9, 2)));
  });

  it('lists the weakest topic first, with levels', () => {
    const topics = computeMastery(
      [at('quiz1', 1, [q('Queues', 1), q('Queues', 1), q('Queues', 1), q('Trees', 0), q('Trees', 0)])],
      fallback,
    );
    assert.deepEqual(
      topics.map((t) => [t.topic, t.level]),
      [
        ['Trees', 'needs_practice'],
        ['Queues', 'mastered'],
      ],
    );
  });

  it('skips questions worth no points, and is empty with no attempts', () => {
    assert.deepEqual(computeMastery([], fallback), []);
    assert.deepEqual(computeMastery([at('quiz1', 1, [{ ...q('X', 0), points: 0 }])], fallback), []);
  });
});
