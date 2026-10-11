import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseApiError } from '@/features/auth/apiError'
import { Markdown } from '@/features/content/Markdown'
import { useExplainAnswerMutation } from './quizApi'

// Under a wrong answer in the student's review: asks the AI why it was
// wrong. Only on request (each new explanation uses one of the student's
// daily AI requests; one already written for the same mistake is free).
export function AiExplain({
  courseId,
  attemptId,
  questionId,
  unanswered,
}: {
  courseId: string
  attemptId: string
  questionId: string
  unanswered: boolean
}) {
  const [explain, { data, error, isLoading, reset }] = useExplainAnswerMutation()
  const [asked, setAsked] = useState(false)
  // The button disappears when clicked; keyboard focus moves to the
  // explanation box so it isn't lost.
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (asked) box.current?.focus()
  }, [asked])
  const ask = () => {
    setAsked(true)
    void explain({ courseId, attemptId, questionId })
  }
  const failure = error ? parseApiError(error) : null
  // Worth retrying only when the AI service was busy or unreachable; not
  // after the daily limit (429) or a refusal.
  const status = error && 'status' in error ? error.status : null
  const canRetry = status === 503 || status === 'FETCH_ERROR'

  if (!asked) {
    return (
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={ask}>
        <Sparkles aria-hidden="true" />
        {unanswered ? 'Explain the answer' : 'Explain my mistake'}
      </Button>
    )
  }

  return (
    <div
      ref={box}
      tabIndex={-1}
      className="rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring border-violet-200 bg-violet-50/60 px-3 py-2 text-sm dark:border-violet-900 dark:bg-violet-950/30"
      aria-live="polite"
      aria-busy={isLoading}
    >
      <p className="flex items-center gap-1.5 font-medium">
        <Sparkles className="size-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />
        AI explanation
      </p>
      {isLoading ? (
        <p className="mt-1 text-muted-foreground">Thinking… this can take up to a minute the first time.</p>
      ) : failure ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-red-700 dark:text-red-300">{failure.message}</p>
          {canRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset()
                ask()
              }}
            >
              Try again
            </Button>
          )}
        </div>
      ) : data ? (
        <>
          <div className="mt-1">
            <Markdown noLinks>{data.feedback}</Markdown>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            AI can make mistakes: check with your notes or your instructor if something looks wrong. {data.left}{' '}
            {data.left === 1 ? 'AI request' : 'AI requests'} left today.
          </p>
        </>
      ) : null}
    </div>
  )
}
