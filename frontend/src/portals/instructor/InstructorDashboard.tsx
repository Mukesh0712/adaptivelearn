import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BookOpen, Plus, UserPlus, Users } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { CopyButton } from '@/components/CopyButton'
import { PageMeta } from '@/components/PageMeta'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { CourseFormDialog } from '@/features/courses/CourseFormDialog'
import { formatJoinCode } from '@/features/courses/joinCode'
import { useInstructorDashboardQuery } from '@/features/dashboard/dashboardApi'
import { timeAgo } from '@/lib/dates'

export default function InstructorDashboard() {
  const { user } = useAuth()
  const { data, error, isLoading, refetch } = useInstructorDashboardQuery()
  const [creating, setCreating] = useState(false)
  const s = data?.stats

  return (
    <div className="space-y-6">
      <PageMeta title="Instructor dashboard" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground">Here's what's happening in your courses.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          New course
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
      ) : !isLoading && s?.activeCourses === 0 ? (
        // First visit: one clear next step instead of a page of zeros.
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BookOpen className="size-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-lg font-medium">Create your first course</p>
              <p className="text-sm text-muted-foreground">
                You'll get a join code to share with your students.
                {s.archivedCourses > 0 && ` (You have ${s.archivedCourses} archived.)`}
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              New course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Active courses" value={s?.activeCourses} icon={BookOpen} loading={isLoading} />
            <StatCard
              label="Students"
              value={s?.students}
              icon={Users}
              hint="Counted once, even if in several courses"
              loading={isLoading}
            />
            <StatCard label="New joins" value={s?.joinsThisWeek} icon={UserPlus} hint="Last 7 days" loading={isLoading} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card>
              <CardHeader>
                <CardTitle>Your courses</CardTitle>
                <CardDescription>Share a join code so students can join.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid gap-2">
                    {Array.from({ length: 3 }, (_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {data?.courses.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <Link
                            to={`/instructor/courses/${c.id}`}
                            className="flex flex-wrap items-center gap-1.5 font-medium hover:underline"
                          >
                            {c.title}
                            {c.code && <Badge variant="secondary">{c.code}</Badge>}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {c.studentCount} {c.studentCount === 1 ? 'student' : 'students'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="font-mono text-sm font-semibold tracking-wider">
                            {formatJoinCode(c.joinCode)}
                          </span>
                          <CopyButton
                            value={formatJoinCode(c.joinCode)}
                            label={`Copy join code for ${c.title}`}
                            successMessage="Join code copied"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!!s && s.activeCourses > (data?.courses.length ?? 0) && (
                  <Link
                    to="/instructor/courses"
                    className={buttonVariants({ variant: 'link', className: 'mt-2 px-0' })}
                  >
                    View all {s.activeCourses} courses
                    <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent joins</CardTitle>
                <CardDescription>Students who joined your courses.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid gap-2">
                    {Array.from({ length: 3 }, (_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : !data?.recentJoins.length ? (
                  <p className="text-sm text-muted-foreground">
                    No one has joined yet. Share a join code with your class.
                  </p>
                ) : (
                  <ul className="grid gap-3">
                    {data.recentJoins.map((j, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          <UserPlus className="size-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p>
                            <span className="font-medium">{j.studentName}</span> joined{' '}
                            <Link to={`/instructor/courses/${j.courseId}`} className="underline-offset-4 hover:underline">
                              {j.courseTitle}
                            </Link>
                          </p>
                          <p className="text-xs text-muted-foreground">{timeAgo(j.joinedAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <CourseFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
