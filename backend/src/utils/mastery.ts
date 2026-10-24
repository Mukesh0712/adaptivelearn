import { bktUpdate, DEFAULT_BKT, guessFor, masteryLevel, type BktParams, type MasteryLevel } from './bkt.js';

// Turns a student's submitted quiz attempts into a mastery estimate per
// topic (see bkt.ts for the model).
//
// Every answered question is one piece of evidence for its topic:
//  - the question's topic tag, or, if it has none, its quiz's module
//    ("General" for a course test that isn't in a module);
//  - tags are grouped ignoring capitals and extra spaces ("Arrays" and
//    "arrays " are the same topic).
// Answers are replayed in the order they were submitted, because BKT is
// about how knowledge changes over time.

export interface AnswerEvidence {
  type: string;
  topic?: string | null;
  optionCount: number;
  points: number;
  earned: number;
}

export interface AttemptEvidence {
  quiz: string; // quiz id
  submittedAt: Date;
  questions: AnswerEvidence[];
}

export interface TopicMastery {
  key: string; // grouping key (lower case)
  topic: string; // shown name
  mastery: number; // 0..1, the BKT probability
  level: MasteryLevel;
  answered: number; // questions answered on this topic
  scorePercent: number; // plain share of points earned, for comparison
  lastPracticed: Date;
}

export const GENERAL_TOPIC = 'General';

export const keyOf = (name: string) => name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

// `fallbackTopic`: quiz id → name used for its untagged questions (the
// module title, or "General").
export function computeMastery(
  attempts: AttemptEvidence[],
  fallbackTopic: Map<string, string>,
  params: BktParams = DEFAULT_BKT,
): TopicMastery[] {
  const topics = new Map<string, TopicMastery & { earnedSum: number; pointsSum: number }>();
  const ordered = [...attempts].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  for (const attempt of ordered) {
    for (const q of attempt.questions) {
      if (!q.points) continue;
      const name = q.topic?.trim() || fallbackTopic.get(attempt.quiz) || GENERAL_TOPIC;
      const key = keyOf(name);
      const t =
        topics.get(key) ??
        ({
          key,
          topic: name.trim().replace(/\s+/g, ' '),
          mastery: params.init,
          level: 'needs_practice',
          answered: 0,
          scorePercent: 0,
          lastPracticed: attempt.submittedAt,
          earnedSum: 0,
          pointsSum: 0,
        } as TopicMastery & { earnedSum: number; pointsSum: number });
      t.mastery = bktUpdate(t.mastery, q.earned / q.points, { ...params, guess: guessFor(q.type, q.optionCount) });
      t.answered++;
      t.earnedSum += q.earned;
      t.pointsSum += q.points;
      t.lastPracticed = attempt.submittedAt;
      topics.set(key, t);
    }
  }

  return [...topics.values()]
    .map(({ earnedSum, pointsSum, ...t }) => ({
      ...t,
      mastery: Math.round(t.mastery * 1000) / 1000,
      level: masteryLevel(t.mastery),
      scorePercent: pointsSum ? Math.round((earnedSum / pointsSum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.mastery - b.mastery || a.topic.localeCompare(b.topic)); // weakest first
}
