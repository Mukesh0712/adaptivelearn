// Run: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessRisk, median, type RiskInput } from './risk.js';

const NOW = new Date(Date.UTC(2026, 9, 30));
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const fine: RiskInput = {
  quizScores: [{ percent: 80, passPercent: 50 }],
  needsPracticeTopics: [],
  lessonsDone: 5,
  totalLessons: 8,
  classMedianDone: 5,
  lastActivity: daysAgo(1),
  missedDue: [],
};
const signals = (i: Partial<RiskInput>) => assessRisk({ ...fine, ...i }, NOW).reasons.map((r) => r.signal);

describe('assessRisk', () => {
  it('a student doing fine is ok', () => {
    assert.deepEqual(assessRisk(fine, NOW), { level: 'ok', reasons: [] });
  });

  it('low scores: average of best scores below the pass mark', () => {
    const r = assessRisk({ ...fine, quizScores: [{ percent: 30, passPercent: 50 }, { percent: 46, passPercent: 50 }] }, NOW);
    assert.deepEqual(r.reasons, [{ signal: 'low_scores', text: 'Average quiz score 38% (pass mark 50%)' }]);
    assert.equal(r.level, 'watch');
    assert.deepEqual(signals({ quizScores: [] }), []); // no quizzes yet: no judgement
  });

  it('low mastery needs at least two weak topics', () => {
    assert.deepEqual(signals({ needsPracticeTopics: ['Queues'] }), []);
    assert.deepEqual(signals({ needsPracticeTopics: ['Queues', 'Trees'] }), ['low_mastery']);
    const text = assessRisk({ ...fine, needsPracticeTopics: ['a', 'b', 'c', 'd', 'e'] }, NOW).reasons[0]!.text;
    assert.equal(text, '5 topics need practice: a, b, c and 2 more');
  });

  it('behind on lessons compared with the class', () => {
    assert.deepEqual(signals({ lessonsDone: 2, classMedianDone: 6 }), ['behind_lessons']);
    assert.deepEqual(signals({ lessonsDone: 3, classMedianDone: 6 }), []); // exactly half: not behind
    assert.deepEqual(signals({ lessonsDone: 0, classMedianDone: 1 }), []); // class has barely started
  });

  it('inactive after 14 days', () => {
    assert.deepEqual(signals({ lastActivity: daysAgo(13) }), []);
    assert.deepEqual(signals({ lastActivity: daysAgo(14) }), ['inactive']);
  });

  it('two or more reasons: at risk', () => {
    const r = assessRisk({ ...fine, missedDue: ['Mid-term'], lastActivity: daysAgo(20) }, NOW);
    assert.equal(r.level, 'at_risk');
    assert.deepEqual(
      r.reasons.map((x) => x.text),
      ['No activity in this course for 20 days', 'Missed 1 graded quiz: Mid-term'],
    );
  });
});

describe('median', () => {
  it('odd, even and empty', () => {
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(median([1, 2, 3, 10]), 2.5);
    assert.equal(median([]), 0);
  });
});
