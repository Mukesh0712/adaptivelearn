import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { formatDateTime } from '@/lib/dates'
import { AttemptResult } from './AttemptReview'
import { useReviewAttemptQuery } from './quizApi'

// Instructor/admin: one student's attempt with every answer shown.
// Route: /{instructor|admin}/courses/:courseId/quizzes/:quizId/attempts/:attemptId
export default function InstructorAttemptPage() {
  const { courseId = '', quizId = '', attemptId = '' } = useParams()
  const isAdmin = useAuth().user?.role === 'admin'
  const resultsPath = `${isAdmin ? '/admin' : '/instructor'}/courses/${courseId}/quizzes/${quizId}/results`
  const { data, error, isLoading, refetch } = useReviewAttemptQuery({ courseId, attemptId })

  const back = (
    <Link to={resultsPath} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      Results
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
        <Skeleton className="h-64 w-full max-w-3xl rounded-xl" />
      </div>
    )
  }

  const { attempt, student, quiz } = data
  return (
    <div className="max-w-3xl space-y-6">
      <PageMeta title={`${student.name}: ${quiz.title}`} />
      <div className="space-y-1">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          {student.name}: attempt {attempt.number}
        </h1>
        <p className="text-sm text-muted-foreground">
          {quiz.title}
          {student.email ? ` · ${student.email}` : ''}
          {attempt.submittedAt ? ` · submitted ${formatDateTime(attempt.submittedAt)}` : ''}
          {attempt.autoSubmitted ? ' (automatically, time ran out)' : ''}
        </p>
      </div>
      {attempt.status === 'in_progress' ? (
        <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          Still in progress: {attempt.answered} of {attempt.total} questions answered so far
          {attempt.deadline ? `, time runs out ${formatDateTime(attempt.deadline)}` : ''}. Results appear when it's
          submitted.
        </p>
      ) : (
        <AttemptResult attempt={attempt} />
      )}
    </div>
  )
}
