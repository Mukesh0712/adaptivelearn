import type { ReactNode } from 'react'
import { AlertTriangle, Check, CheckCircle2, LoaderCircle, MinusCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Markdown } from '@/features/content/Markdown'
import { cn } from '@/lib/utils'
import type { Attempt, AttemptQuestion, StudentAnswer, Verdict } from './types'

// Shared by the student's attempt page and the instructor's review page.

export type SaveState = 'saving' | 'saved' | 'error'

const VERDICT: Record<Verdict, { label: string; icon: typeof Check; className: string }> = {
  correct: { label: 'Correct', icon: CheckCircle2, className: 'text-emerald-700 dark:text-emerald-300' },
  partial: { label: 'Partly correct', icon: MinusCircle, className: 'text-amber-700 dark:text-amber-300' },
  wrong: { label: 'Wrong', icon: XCircle, className: 'text-red-700 dark:text-red-300' },
  unanswered: { label: 'Not answered', icon: MinusCircle, className: 'text-muted-foreground' },
}

// One question: its text and the answer controls. `review` makes them
// read-only and, when answers are revealed, marks what was right.
export function QuestionBlock({
  q,
  index,
  answer,
  onChange,
  onBlurText,
  state,
  review = false,
}: {
  q: AttemptQuestion
  index: number
  answer: StudentAnswer
  onChange?: (a: StudentAnswer) => void
  onBlurText?: () => void
  state?: SaveState
  review?: boolean
}) {
  const name = `q-${q.id}`
  const legendId = `${name}-legend`
  const revealed = review && q.verdict !== undefined
  const correct = new Set(q.correctOptions ?? [])
  const v = revealed ? VERDICT[q.verdict!] : null

  return (
    <fieldset className="grid gap-3" aria-labelledby={legendId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div id={legendId} className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            Question {index + 1} · {q.points} {q.points === 1 ? 'point' : 'points'}
            {q.type === 'multiple' && ' · select all that apply'}
          </p>
          <div className="mt-1">
            <Markdown>{q.text}</Markdown>
          </div>
        </div>
        {!review && state && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {state === 'saving' ? (
              <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
            ) : state === 'saved' ? (
              <Check className="size-3" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-3 text-red-700" aria-hidden="true" />
            )}
            {state === 'saving' ? 'Saving' : state === 'saved' ? 'Saved' : 'Not saved'}
          </span>
        )}
        {v && (
          <span className={cn('flex items-center gap-1 text-sm font-medium', v.className)}>
            <v.icon className="size-4" aria-hidden="true" />
            {v.label} · {q.earned}/{q.points}
          </span>
        )}
      </div>

      {(q.type === 'single' || q.type === 'multiple') && (
        <div className="grid gap-2">
          {q.options.map((o) => {
            const chosen = answer.selected.includes(o.id)
            return (
              <label
                key={o.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                  !review && 'cursor-pointer hover:bg-muted',
                  chosen && 'border-primary',
                  revealed && correct.has(o.id) && 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
                )}
              >
                <input
                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                  name={name}
                  className="size-4 shrink-0 accent-primary"
                  checked={chosen}
                  disabled={review}
                  onChange={() =>
                    onChange?.({
                      ...answer,
                      selected:
                        q.type === 'single' ? [o.id] : chosen ? answer.selected.filter((x) => x !== o.id) : [...answer.selected, o.id],
                    })
                  }
                />
                <span className="flex-1 break-words">{o.text}</span>
                {revealed && correct.has(o.id) && (
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Correct answer</span>
                )}
              </label>
            )
          })}
        </div>
      )}

      {q.type === 'true_false' && (
        <div className="flex flex-wrap gap-2">
          {[true, false].map((val) => (
            <label
              key={String(val)}
              className={cn(
                'flex min-w-28 items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                !review && 'cursor-pointer hover:bg-muted',
                answer.bool === val && 'border-primary',
                revealed && q.correctBool === val && 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
              )}
            >
              <input
                type="radio"
                name={name}
                className="size-4 accent-primary"
                checked={answer.bool === val}
                disabled={review}
                onChange={() => onChange?.({ ...answer, bool: val })}
              />
              {val ? 'True' : 'False'}
              {revealed && q.correctBool === val && (
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Correct</span>
              )}
            </label>
          ))}
        </div>
      )}

      {q.type === 'short' && (
        <div className="grid gap-1.5">
          <Input
            aria-labelledby={legendId}
            inputMode={q.answerMode === 'number' ? 'decimal' : 'text'}
            autoComplete="off"
            maxLength={500}
            value={answer.text}
            readOnly={review}
            placeholder={review ? 'Not answered' : q.answerMode === 'number' ? 'Type a number' : 'Type your answer'}
            onChange={(e) => onChange?.({ ...answer, text: e.target.value })}
            onBlur={onBlurText}
          />
          {revealed && (
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              {q.answerMode === 'number'
                ? `Correct answer: ${q.numericAnswer}${q.tolerance ? ` (± ${q.tolerance})` : ''}`
                : `Accepted: ${(q.acceptedAnswers ?? []).join(' / ')}`}
            </p>
          )}
        </div>
      )}

      {revealed && q.explanation && (
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <p className="font-medium">Explanation</p>
          <Markdown>{q.explanation}</Markdown>
        </div>
      )}
    </fieldset>
  )
}


// The score card, the "answers shown later" note and the question review.
export function AttemptResult({ attempt, action }: { attempt: Attempt; action?: ReactNode }) {
  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Score</p>
            <p className="text-3xl font-semibold tabular-nums">
              {attempt.score}/{attempt.maxScore}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Percentage</p>
            <p className="text-3xl font-semibold tabular-nums">{attempt.percent}%</p>
          </div>
          <Badge
            className={
              attempt.passed
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
            }
          >
            {attempt.passed ? 'Passed' : 'Not passed'} (pass mark {attempt.passPercent}%)
          </Badge>
          {action}
        </CardContent>
      </Card>

      {!attempt.revealed && attempt.revealHint && (
        <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{attempt.revealHint}</p>
      )}

      <section aria-labelledby="review-heading" className="space-y-3">
        <h2 id="review-heading" className="text-lg font-semibold">
          {attempt.revealed ? 'Review' : 'Your answers'}
        </h2>
        <ol className="space-y-4">
          {attempt.questions.map((q, i) => (
            <li key={q.id}>
              <Card>
                <CardContent>
                  <QuestionBlock q={q} index={i} answer={q.answer} review />
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
