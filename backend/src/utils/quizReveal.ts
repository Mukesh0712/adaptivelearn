// When a student may see the correct answers and explanations of an
// attempt they submitted. The score itself is always shown.
//
// "auto" (the default) picks a sensible rule for the kind of quiz:
//  - practice quiz         → right after submitting;
//  - graded, with due date → after the due date (so answers can't be
//                            passed to classmates who haven't taken it);
//  - graded, no due date   → after the student's last allowed attempt;
//                            with unlimited attempts: never.

export interface RevealSettings {
  reveal: string;
  kind: string;
  dueAt?: Date | null;
  maxAttempts?: number | null;
}

export function answersVisible(quiz: RevealSettings, attemptsUsed: number, now = new Date()): boolean {
  const afterDue = !!quiz.dueAt && now.getTime() >= quiz.dueAt.getTime();
  switch (quiz.reveal) {
    case 'immediately':
      return true;
    case 'after_due':
      return afterDue;
    case 'never':
      return false;
    default: // auto
      if (quiz.kind === 'practice') return true;
      if (quiz.dueAt) return afterDue;
      return !!quiz.maxAttempts && attemptsUsed >= quiz.maxAttempts;
  }
}

// When they will be visible, for the message shown until then.
export function revealHint(quiz: RevealSettings): string {
  if (quiz.reveal === 'never') return 'Your instructor has chosen not to show the answers for this quiz.';
  if ((quiz.reveal === 'after_due' || (quiz.reveal === 'auto' && quiz.kind === 'graded')) && quiz.dueAt) {
    return 'Correct answers will be shown after the due date.';
  }
  if (quiz.reveal === 'auto' && quiz.kind === 'graded' && quiz.maxAttempts) {
    return 'Correct answers will be shown after your last attempt.';
  }
  return 'Correct answers are not shown for this quiz.';
}
