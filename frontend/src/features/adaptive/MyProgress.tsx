import { Link } from 'react-router'
import { BookOpen, ClipboardList, Clock, Compass, PlayCircle, RotateCcw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useMyMasteryQuery } from './adaptiveApi'
import { LEVEL_LABEL, type MasteryLevel, type NextStep, type TopicMastery } from './types'

const LEVEL_STYLE: Record<MasteryLevel, { bar: string; text: string }> = {
  mastered: { bar: 'bg-emerald-600', text: 'text-emerald-800 dark:text-emerald-300' },
  learning: { bar: 'bg-amber-500', text: 'text-amber-800 dark:text-amber-300' },
  needs_practice: { bar: 'bg-red-600', text: 'text-red-800 dark:text-red-300' },
}

// Student course page: what to do next, and how well each topic is known.
export function MyProgress({ courseId }: { courseId: string }) {
  const { data, error, isLoading, refetch } = useMyMasteryQuery(courseId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="size-4" aria-hidden="true" />
          <h2>My progress</h2>
        </CardTitle>
        <CardDescription>Suggestions based on your quiz answers and the lessons you've finished.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {error ? (
          <div className="flex items-center gap-2 text-sm lg:col-span-2">
            <p className="text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : isLoading || !data ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            <section aria-labelledby="next-steps-heading" className="space-y-2">
              <h3 id="next-steps-heading" className="text-sm font-medium">
                Next steps
              </h3>
              {data.nextSteps.length ? (
                <ol className="grid gap-2">
                  {data.nextSteps.map((s) => (
                    <li key={s.target.id}>
                      <StepLink step={s} courseId={courseId} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">You're all caught up. Nice work!</p>
              )}
            </section>

            <section aria-labelledby="topics-heading" className="space-y-2">
              <h3 id="topics-heading" className="text-sm font-medium">
                Topics
              </h3>
              {data.topics.length ? (
                <>
                  <ul className="grid gap-3">
                    {data.topics.map((t) => (
                      <li key={t.topic}>
                        <TopicBar t={t} />
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Mastery is the estimated chance you've learned a topic, from all your quiz answers (Bayesian
                    Knowledge Tracing). It updates after every quiz.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Take a quiz to see how well you know each topic.
                </p>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TopicBar({ t }: { t: TopicMastery }) {
  const percent = Math.round(t.mastery * 100)
  const style = LEVEL_STYLE[t.level]
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="font-medium break-words">{t.topic}</span>
        <span className={cn('text-xs font-medium', style.text)}>
          {LEVEL_LABEL[t.level]} · {percent}%
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${t.topic} mastery`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%, ${LEVEL_LABEL[t.level]}`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn('h-full rounded-full', style.bar)} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {t.answered} {t.answered === 1 ? 'question' : 'questions'} answered · {t.scorePercent}% of points · last{' '}
        {formatDateTime(t.lastPracticed)}
      </p>
    </div>
  )
}

// One suggestion: what to do, and why.
function StepLink({ step, courseId }: { step: NextStep; courseId: string }) {
  const base = `/student/courses/${courseId}`
  const to = step.target.type === 'lesson' ? `${base}/lessons/${step.target.id}` : `${base}/quizzes/${step.target.id}`
  const t = step.target.title
  const why = step.level === 'needs_practice' ? 'needs more practice' : 'is still being learned'
  const { icon: Icon, action, reason } = {
    finish_quiz: { icon: PlayCircle, action: `Finish ${t}`, reason: 'You have an attempt in progress.' },
    due_quiz: { icon: Clock, action: `Take ${t}`, reason: `Due ${formatDateTime(step.dueAt)}.` },
    review_lesson: { icon: RotateCcw, action: `Re-read ${t}`, reason: `${step.topic} ${why}.` },
    practice_quiz: { icon: Target, action: `Practise with ${t}`, reason: `${step.topic} ${why}.` },
    next_lesson: { icon: BookOpen, action: `Continue with ${t}`, reason: 'Next lesson in the course.' },
    new_quiz: { icon: ClipboardList, action: `Try ${t}`, reason: "You've finished its lessons." },
  }[step.kind]

  return (
    <Link to={to} className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-medium break-words">{action}</span>
        <span className="block text-muted-foreground">{reason}</span>
      </span>
    </Link>
  )
}
