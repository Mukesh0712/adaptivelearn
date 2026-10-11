import { Link, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, FileText } from 'lucide-react'
import { PageMeta } from '@/components/PageMeta'
import { ProgressBar } from '@/components/ProgressBar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { useCourseContentQuery } from '@/features/content/contentApi'
import { StudentQuizRow } from '@/features/quizzes/StudentQuizRow'
import type { StudentQuizItem } from '@/features/quizzes/types'

// Student: one course's outline (published lessons only, in reading order).
export default function StudentCoursePage() {
  const { courseId = '' } = useParams()
  const { data, error, isLoading, refetch } = useCourseContentQuery(courseId)

  const back = (
    <Link to="/student/courses" className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      My courses
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
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const { course, modules, progress } = data
  const courseTests = data.courseTests ?? []
  const all = modules.flatMap((m) => m.lessons)
  // "Continue" opens the first lesson not done yet (or the first one).
  const nextUp = all.find((l) => !l.done) ?? all[0]
  const started = all.some((l) => l.done)
  const finished = all.length > 0 && all.every((l) => l.done)
  const lessonPath = (id: string) => `/student/courses/${course.id}/lessons/${id}`

  return (
    <div className="space-y-6">
      <PageMeta title={course.title} />
      <div className="space-y-2">
        {back}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight break-words">{course.title}</h1>
            {course.code && (
              <Badge variant="secondary" className="mt-1.5">
                {course.code}
              </Badge>
            )}
          </div>
          {nextUp && (
            <Link to={lessonPath(nextUp.id)} className={buttonVariants()}>
              {finished ? 'Review from the beginning' : started ? 'Continue' : 'Start from the beginning'}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {progress && progress.total > 0 && (
        <ProgressBar done={progress.done} total={progress.total} label={`Your progress in ${course.title}`} className="max-w-md" />
      )}

      {!modules.length && !courseTests.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BookOpen className="size-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">No lessons yet</p>
              <p className="text-sm text-muted-foreground">
                Your instructor hasn't published any lessons. They'll appear here when they do.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {modules.map((mod, mi) => (
            <Card key={mod.id} className="gap-2">
              <CardHeader>
                <CardTitle className="break-words">
                  <h2>
                    <span className="text-muted-foreground">Module {mi + 1}:</span> {mod.title}
                  </h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2">
                <ol aria-label={`Lessons in ${mod.title}`}>
                  {mod.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        to={lessonPath(lesson.id)}
                        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                      >
                        {lesson.done ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="break-words">{lesson.title}</span>
                        {lesson.done && <span className="sr-only"> (done)</span>}
                      </Link>
                    </li>
                  ))}
                </ol>
                {!!mod.quizzes?.length && (
                  <ul aria-label={`Quizzes in ${mod.title}`} className={mod.lessons.length ? 'mt-1 border-t pt-1' : ''}>
                    {(mod.quizzes as StudentQuizItem[]).map((quiz) => (
                      <li key={quiz.id}>
                        <StudentQuizRow quiz={quiz} courseId={course.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
          {courseTests.length > 0 && (
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>
                  <h2>Course tests</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2">
                <ul aria-label="Course tests">
                  {courseTests.map((quiz) => (
                    <li key={quiz.id}>
                      <StudentQuizRow quiz={quiz} courseId={course.id} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
