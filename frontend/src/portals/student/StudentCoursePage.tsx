import { Link, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, BookOpen, FileText } from 'lucide-react'
import { PageMeta } from '@/components/PageMeta'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { useCourseContentQuery } from '@/features/content/contentApi'

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

  const { course, modules } = data
  const first = modules[0]?.lessons[0]
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
          {first && (
            <Link to={lessonPath(first.id)} className={buttonVariants()}>
              Start from the beginning
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {!modules.length ? (
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
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="break-words">{lesson.title}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
