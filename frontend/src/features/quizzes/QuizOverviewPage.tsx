import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Clock, Play, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { PageMeta } from '@/components/PageMeta'
import { SubmitButton } from '@/components/SubmitButton'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { parseApiError } from '@/features/auth/apiError'
import { Markdown } from '@/features/content/Markdown'
import { formatDateTime } from '@/lib/dates'
import { useQuizOverviewQuery, useStartAttemptMutation } from './quizApi'

// Student: a quiz's rules, their attempts, and Start / Resume.
// Route: /student/courses/:courseId/quizzes/:quizId
export default function QuizOverviewPage() {
  const { courseId = '', quizId = '' } = useParams()
  const navigate = useNavigate()
  const { data, error, isLoading, refetch } = useQuizOverviewQuery({ courseId, quizId })
  const [start, { isLoading: starting }] = useStartAttemptMutation()
  const coursePath = `/student/courses/${courseId}`
  const attemptPath = (id: string) => `${coursePath}/quizzes/${quizId}/attempts/${id}`

  const back = (
    <Link to={coursePath} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      {data?.course.title ?? 'Course'}
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
        <Skeleton className="h-48 w-full max-w-3xl rounded-xl" />
      </div>
    )
  }

  const { quiz, attempts, inProgressId, cannotStart, bestPercent } = data
  const submitted = attempts.filter((a) => a.status === 'submitted')
  const doStart = async () => {
    try {
      const res = await start({ courseId, quizId }).unwrap()
      toast.success(res.message)
      void navigate(attemptPath(res.attempt.id))
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const facts: [string, string][] = [
    ['Questions', `${quiz.questionCount} (${quiz.totalPoints} ${quiz.totalPoints === 1 ? 'point' : 'points'})`],
    ['Time limit', quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} minutes` : 'None'],
    ['Attempts', quiz.maxAttempts ? `${submitted.length} of ${quiz.maxAttempts} used` : `${submitted.length} used (unlimited)`],
    ['Pass mark', `${quiz.passPercent}%`],
    ['Due', quiz.dueAt ? formatDateTime(quiz.dueAt) : 'No due date'],
  ]

  return (
    <div className="max-w-3xl space-y-6">
      <PageMeta title={quiz.title} />
      <div className="space-y-2">
        {back}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{quiz.title}</h1>
          <Badge variant="secondary">{quiz.kind === 'graded' ? 'Graded' : 'Practice'}</Badge>
        </div>
        {bestPercent !== null && <p className="text-sm text-muted-foreground">Your best score: {bestPercent}%</p>}
      </div>

      <Card>
        <CardContent className="grid gap-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b py-1.5 sm:block sm:border-0 sm:py-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {quiz.instructions.trim() && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <Markdown>{quiz.instructions}</Markdown>
            </div>
          )}
          {quiz.timeLimitMinutes && !inProgressId && !cannotStart && (
            <p className="flex items-start gap-2 text-sm">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              The timer starts when you click Start and keeps running if you leave the page. Your answers are saved as
              you go.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {inProgressId ? (
              <Link to={attemptPath(inProgressId)} className={buttonVariants()}>
                <Play aria-hidden="true" />
                Resume attempt
              </Link>
            ) : cannotStart ? (
              <p className="text-sm font-medium">{cannotStart}</p>
            ) : (
              <SubmitButton type="button" className="sm:w-auto" loading={starting} loadingText="Starting…" onClick={() => void doStart()}>
                {submitted.length ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}
                {submitted.length ? 'Try again' : 'Start quiz'}
              </SubmitButton>
            )}
          </div>
        </CardContent>
      </Card>

      {attempts.length > 0 && (
        <Card className="gap-0 pb-0">
          <CardHeader className="pb-3">
            <CardTitle>
              <h2>Your attempts</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableCaption className="sr-only">Your attempts at {quiz.title}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Attempt</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="hidden sm:table-cell">Submitted</TableHead>
                  <TableHead className="pr-4">
                    <span className="sr-only">Details</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-4">#{a.number}</TableCell>
                    <TableCell>
                      {a.status === 'in_progress' ? (
                        'In progress'
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {a.score}/{a.maxScore} ({a.percent}%)
                          <Badge variant={a.passed ? 'secondary' : 'outline'}>{a.passed ? 'Passed' : 'Not passed'}</Badge>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{a.submittedAt ? formatDateTime(a.submittedAt) : '-'}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Link to={attemptPath(a.id)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                        {a.status === 'in_progress' ? 'Resume' : 'Review'}
                        <span className="sr-only"> attempt {a.number}</span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
