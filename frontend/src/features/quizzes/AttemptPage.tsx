import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock, LoaderCircle, MinusCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageMeta } from '@/components/PageMeta'
import { SubmitButton } from '@/components/SubmitButton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { Markdown } from '@/features/content/Markdown'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useAttemptQuery, useSaveAnswerMutation, useSubmitAttemptMutation } from './quizApi'
import type { Attempt, AttemptQuestion, StudentAnswer, Verdict } from './types'

// Student: one attempt. In progress → answer the questions; submitted →
// the result (and the answers, when the quiz reveals them).
// Route: /student/courses/:courseId/quizzes/:quizId/attempts/:attemptId
export default function AttemptPage() {
  const { courseId = '', quizId = '', attemptId = '' } = useParams()
  const { data, error, isLoading, refetch } = useAttemptQuery({ courseId, attemptId })
  const quizPath = `/student/courses/${courseId}/quizzes/${quizId}`

  const back = (
    <Link to={quizPath} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      {data?.quiz.title ?? 'Quiz'}
    </Link>
  )
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full max-w-3xl rounded-xl" />
      </div>
    )
  }
  return data.attempt.status === 'in_progress' ? (
    // key: a fresh form per attempt.
    <TakeQuiz key={data.attempt.id} attempt={data.attempt} title={data.quiz.title} courseId={courseId} back={back} onEnded={() => void refetch()} />
  ) : (
    <Results attempt={data.attempt} title={data.quiz.title} quizPath={quizPath} back={back} />
  )
}

const isAnswered = (a: StudentAnswer) => a.selected.length > 0 || a.bool !== null || a.text.trim() !== ''

// 125 → "2:05", 3725 → "1:02:05"
function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

type SaveState = 'saving' | 'saved' | 'error'

function TakeQuiz({
  attempt,
  title,
  courseId,
  back,
  onEnded,
}: {
  attempt: Attempt
  title: string
  courseId: string
  back: React.ReactNode
  onEnded: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>(() =>
    Object.fromEntries(attempt.questions.map((q) => [q.id, q.answer])),
  )
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})
  const [confirm, setConfirm] = useState(false)
  const [saveAnswer] = useSaveAnswerMutation()
  const [submit, { isLoading: submitting }] = useSubmitAttemptMutation()
  const textTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pending = useRef<Record<string, Promise<unknown>>>({})
  const ended = useRef(false)

  // Server time minus this PC's time: the countdown uses the server's clock,
  // so a wrong PC clock can't give extra time (the server enforces it anyway).
  const [offset] = useState(() => (attempt.serverNow ? new Date(attempt.serverNow).getTime() - Date.now() : 0))
  const deadline = attempt.deadline ? new Date(attempt.deadline).getTime() : null
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => setNow(Date.now() + offset), 1000)
    return () => clearInterval(t)
  }, [deadline, offset])
  const remaining = deadline ? Math.floor((deadline - now) / 1000) : null

  const endWith = useCallback(
    (message: string) => {
      if (ended.current) return
      ended.current = true
      toast.info(message)
      onEnded()
    },
    [onEnded],
  )

  const send = useCallback(
    (questionId: string, answer: Partial<StudentAnswer>) => {
      setSaveState((s) => ({ ...s, [questionId]: 'saving' }))
      const p = saveAnswer({ courseId, attemptId: attempt.id, questionId, answer })
        .unwrap()
        .then(() => setSaveState((s) => ({ ...s, [questionId]: 'saved' })))
        .catch((err: unknown) => {
          const { message } = parseApiError(err)
          // 409: time ran out or it was submitted elsewhere → show the result.
          if ((err as { status?: number }).status === 409) endWith(message)
          else {
            setSaveState((s) => ({ ...s, [questionId]: 'error' }))
            toast.error(`Question not saved: ${message}`)
          }
        })
      pending.current[questionId] = p
      return p
    },
    [saveAnswer, courseId, attempt.id, endWith],
  )

  const change = (q: AttemptQuestion, next: StudentAnswer) => {
    setAnswers((a) => ({ ...a, [q.id]: next }))
    if (q.type === 'short') {
      // Typing: save after a short pause (and on leaving the field).
      clearTimeout(textTimers.current[q.id])
      textTimers.current[q.id] = setTimeout(() => void send(q.id, { text: next.text }), 700)
    } else if (q.type === 'true_false') void send(q.id, { bool: next.bool })
    else void send(q.id, { selected: next.selected })
  }
  const flushText = (q: AttemptQuestion) => {
    if (textTimers.current[q.id]) {
      clearTimeout(textTimers.current[q.id])
      delete textTimers.current[q.id]
      void send(q.id, { text: answers[q.id]!.text })
    }
  }

  const doSubmit = useCallback(async () => {
    // Send typed answers still waiting for their pause, then wait for all saves.
    for (const [id, timer] of Object.entries(textTimers.current)) {
      clearTimeout(timer)
      delete textTimers.current[id]
      void send(id, { text: answers[id]!.text })
    }
    await Promise.allSettled(Object.values(pending.current))
    if (ended.current) return
    try {
      const res = await submit({ courseId, attemptId: attempt.id }).unwrap()
      ended.current = true
      toast.success(res.message)
    } catch (err) {
      if ((err as { status?: number }).status === 409) endWith(parseApiError(err).message)
      else toast.error(parseApiError(err).message)
    }
  }, [answers, send, submit, courseId, attempt.id, endWith])

  // Time's up: submit what is there.
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !ended.current && !submitting) void doSubmit()
  }, [remaining, submitting, doSubmit])

  const answeredCount = attempt.questions.filter((q) => isAnswered(answers[q.id]!)).length
  const unanswered = attempt.questions.length - answeredCount
  const saving = Object.values(saveState).some((s) => s === 'saving')
  const failed = Object.values(saveState).some((s) => s === 'error')
  const low = remaining !== null && remaining <= 60

  return (
    <div className="max-w-3xl space-y-6">
      <PageMeta title={`${title}: attempt ${attempt.number}`} />
      <div className="space-y-1">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>
        <p className="text-sm text-muted-foreground">Attempt {attempt.number}. Your answers are saved as you go.</p>
      </div>

      {/* Stays at the top while scrolling: time left, progress, save status. */}
      <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {remaining !== null && (
            <span
              className={cn(
                'flex items-center gap-1.5 font-medium tabular-nums',
                low && 'text-red-700 dark:text-red-300',
              )}
            >
              <Clock className="size-4" aria-hidden="true" />
              <span>
                <span className="sr-only">Time left: </span>
                {clock(remaining)}
              </span>
            </span>
          )}
          <span>
            Answered {answeredCount} of {attempt.questions.length}
          </span>
          <span className="text-muted-foreground" aria-live="polite">
            {failed ? 'Some answers were not saved' : saving ? 'Saving…' : 'All answers saved'}
          </span>
          <Button size="sm" className="ml-auto" disabled={submitting} onClick={() => setConfirm(true)}>
            Submit
          </Button>
        </div>
        {/* Spoken warnings at 5 and 1 minutes left (not every second). */}
        <p className="sr-only" aria-live="assertive">
          {remaining !== null && remaining <= 300 && remaining > 290 ? '5 minutes left' : ''}
          {remaining !== null && remaining <= 60 && remaining > 50 ? '1 minute left' : ''}
        </p>
      </div>

      <ol className="space-y-4">
        {attempt.questions.map((q, i) => (
          <li key={q.id}>
            <Card>
              <CardContent>
                <QuestionBlock
                  q={q}
                  index={i}
                  answer={answers[q.id]!}
                  onChange={(a) => change(q, a)}
                  onBlurText={() => flushText(q)}
                  state={saveState[q.id]}
                />
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <span className="text-sm text-muted-foreground">
          {unanswered ? `${unanswered} not answered yet` : 'Every question answered'}
        </span>
        <Button disabled={submitting} onClick={() => setConfirm(true)}>
          Submit answers
        </Button>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
            <AlertDialogDescription>
              {unanswered
                ? `${unanswered} ${unanswered === 1 ? 'question is' : 'questions are'} not answered and will get 0 points. `
                : ''}
              You can't change your answers after submitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <SubmitButton
              type="button"
              className="sm:w-auto"
              loading={submitting}
              loadingText="Submitting…"
              onClick={() => void doSubmit()}
            >
              Submit
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const VERDICT: Record<Verdict, { label: string; icon: typeof Check; className: string }> = {
  correct: { label: 'Correct', icon: CheckCircle2, className: 'text-emerald-700 dark:text-emerald-300' },
  partial: { label: 'Partly correct', icon: MinusCircle, className: 'text-amber-700 dark:text-amber-300' },
  wrong: { label: 'Wrong', icon: XCircle, className: 'text-red-700 dark:text-red-300' },
  unanswered: { label: 'Not answered', icon: MinusCircle, className: 'text-muted-foreground' },
}

// One question: its text and the answer controls. `review` makes them
// read-only and, when answers are revealed, marks what was right.
function QuestionBlock({
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

function Results({ attempt, title, quizPath, back }: { attempt: Attempt; title: string; quizPath: string; back: React.ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <div className="max-w-3xl space-y-6">
      <PageMeta title={`${title}: result`} />
      <div className="space-y-1">
        {back}
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight break-words outline-none">
          {title}: attempt {attempt.number}
        </h1>
        {attempt.submittedAt && (
          <p className="text-sm text-muted-foreground">
            Submitted {formatDateTime(attempt.submittedAt)}
            {attempt.autoSubmitted ? ' automatically when time ran out' : ''}
          </p>
        )}
      </div>

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
          <Link to={quizPath} className={buttonVariants({ variant: 'outline', className: 'sm:ml-auto' })}>
            Back to the quiz
          </Link>
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
    </div>
  )
}
