import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BookOpen, Plus } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { useEnrolledCoursesQuery } from '@/features/courses/coursesApi'
import { JoinCourseDialog } from '@/features/courses/JoinCourseDialog'

const SHOWN = 6

// Student home: their courses at a glance, and joining a new one.
export default function StudentDashboard() {
  const { user } = useAuth()
  const { data, error, isLoading, refetch } = useEnrolledCoursesQuery()
  const [joining, setJoining] = useState(false)
  const courses = data?.courses ?? []

  return (
    <div className="space-y-6">
      <PageMeta title="Student dashboard" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? 'Loading your courses…'
              : courses.length
                ? `You're in ${courses.length} ${courses.length === 1 ? 'course' : 'courses'}.`
                : 'Join your first course with the code from your instructor.'}
          </p>
        </div>
        <Button onClick={() => setJoining(true)}>
          <Plus aria-hidden="true" />
          Join course
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !courses.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BookOpen className="size-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-lg font-medium">No courses yet</p>
              <p className="text-sm text-muted-foreground">Ask your instructor for a 6-character join code.</p>
            </div>
            <Button onClick={() => setJoining(true)}>
              <Plus aria-hidden="true" />
              Join course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.slice(0, SHOWN).map((c) => (
              <Card key={c.id} className="gap-2">
                <CardHeader>
                  <CardTitle className="leading-snug break-words">{c.title}</CardTitle>
                  {c.code && (
                    <Badge variant="secondary" className="mt-1">
                      {c.code}
                    </Badge>
                  )}
                  <CardDescription>Instructor: {c.instructorName}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Link to="/student/courses" className={buttonVariants({ variant: 'link', className: 'px-0' })}>
            {courses.length > SHOWN ? `View all ${courses.length} courses` : 'Go to My courses'}
            <ArrowRight aria-hidden="true" />
          </Link>
        </>
      )}

      <JoinCourseDialog open={joining} onOpenChange={setJoining} />
    </div>
  )
}
