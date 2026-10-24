// Run: npm test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recommend, type RecLesson, type RecQuiz, type RecTopic } from './recommend.js';

const NOW = new Date(Date.UTC(2026, 9, 10));
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const lessons: RecLesson[] = [
  { id: 'l1', title: 'Arrays', moduleId: 'm1', done: true },
  { id: 'l2', title: 'Linked lists', moduleId: 'm1', done: false },
  { id: 'l3', title: 'Trees', moduleId: 'm2', done: false },
];
const quiz = (over: Partial<RecQuiz> & { id: string }): RecQuiz => ({
  title: over.id,
  moduleId: 'm1',
  kind: 'practice',
  dueAt: null,
  maxAttempts: null,
  topicKeys: [],
  attemptsUsed: 0,
  inProgress: false,
  ...over,
});
const topic = (key: string, level: RecTopic['level'], mastery: number): RecTopic => ({ key, topic: key, level, mastery });
const kinds = (steps: ReturnType<typeof recommend>) => steps.map((s) => `${s.kind}:${s.target.id}`);

describe('recommend', () => {
  it('a new student: start with the first unfinished lesson', () => {
    const fresh = lessons.map((l) => ({ ...l, done: false }));
    assert.deepEqual(kinds(recommend(fresh, [], [], NOW)), ['next_lesson:l1']);
  });

  it('puts an unfinished attempt and a due quiz first', () => {
    const steps = recommend(
      lessons,
      [quiz({ id: 'qDue', kind: 'graded', dueAt: days(3) }), quiz({ id: 'qOpen', inProgress: true, attemptsUsed: 1 })],
      [],
      NOW,
    );
    assert.deepEqual(kinds(steps).slice(0, 2), ['finish_quiz:qOpen', 'due_quiz:qDue']);
    assert.deepEqual(steps[1]!.dueAt, days(3));
  });

  it('ignores quizzes due later than a week, past due, or already taken', () => {
    const steps = recommend(
      lessons,
      [
        quiz({ id: 'later', dueAt: days(10) }),
        quiz({ id: 'past', dueAt: days(-1) }),
        quiz({ id: 'taken', dueAt: days(2), attemptsUsed: 1 }),
      ],
      [],
      NOW,
    );
    assert.ok(!kinds(steps).some((k) => k.startsWith('due_quiz')));
  });

  it('weak topic: review a lesson of its module, then practise it', () => {
    const steps = recommend(
      lessons,
      [quiz({ id: 'qGraded', kind: 'graded', topicKeys: ['lists'] }), quiz({ id: 'qPractice', topicKeys: ['lists'], attemptsUsed: 1 })],
      [topic('lists', 'needs_practice', 0.2)],
      NOW,
    );
    // l2 is the first lesson not done in m1; the practice quiz is preferred.
    assert.deepEqual(kinds(steps).slice(0, 2), ['review_lesson:l2', 'practice_quiz:qPractice']);
    assert.equal(steps[0]!.topic, 'lists');
  });

  it('prefers a lesson named after the topic', () => {
    const steps = recommend(lessons, [quiz({ id: 'q', topicKeys: ['arrays'], attemptsUsed: 1 })], [topic('arrays', 'learning', 0.6)], NOW);
    // l1 "Arrays" is done, but it's the one about this topic.
    assert.equal(steps[0]!.target.id, 'l1');
  });

  it('"needs practice" topics come before "learning" ones, at most two, mastered never', () => {
    const steps = recommend(
      lessons,
      [
        quiz({ id: 'qA', topicKeys: ['a'], attemptsUsed: 1 }),
        quiz({ id: 'qB', moduleId: 'm2', topicKeys: ['b'], attemptsUsed: 1 }),
        quiz({ id: 'qC', topicKeys: ['c'], attemptsUsed: 1 }),
        quiz({ id: 'qD', topicKeys: ['d'], attemptsUsed: 1 }),
      ],
      [topic('a', 'learning', 0.5), topic('b', 'needs_practice', 0.3), topic('c', 'learning', 0.45), topic('d', 'mastered', 0.97)],
      NOW,
    );
    const practised = steps.filter((s) => s.kind === 'practice_quiz').map((s) => s.topic);
    assert.deepEqual(practised, ['b', 'c']);
  });

  it('no practice step when the quiz is closed (attempts used up)', () => {
    const steps = recommend(lessons, [quiz({ id: 'q', topicKeys: ['x'], maxAttempts: 1, attemptsUsed: 1 })], [topic('x', 'needs_practice', 0.1)], NOW);
    assert.ok(!kinds(steps).some((k) => k.startsWith('practice_quiz')));
  });

  it('suggests a new quiz only once its lessons are done', () => {
    const allDone = lessons.map((l) => ({ ...l, done: l.moduleId === 'm1' }));
    const steps = recommend(allDone, [quiz({ id: 'qM1' }), quiz({ id: 'qM2', moduleId: 'm2' })], [], NOW);
    assert.ok(kinds(steps).includes('new_quiz:qM1'));
    assert.ok(!kinds(steps).includes('new_quiz:qM2'));
  });

  it('each target once, five steps at most', () => {
    const many = Array.from({ length: 8 }, (_, i) => quiz({ id: `q${i}`, inProgress: true }));
    const steps = recommend(lessons, many, [], NOW);
    assert.equal(steps.length, 5);
    assert.equal(new Set(steps.map((s) => s.target.id)).size, 5);
  });
});
