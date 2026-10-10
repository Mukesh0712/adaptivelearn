import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BookOpen, Clock, LogOut, MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageMeta } from '@/components/PageMeta'
import { ProgressBar } from '@/components/ProgressBar'
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { useCancelJoinRequestMutation, useEnrolledCoursesQuery, useLeaveCourseMutation } from '@/features/courses/coursesApi'
import { JoinCourseDialog } from '@/features/courses/JoinCourseDialog'
import type { EnrolledCourse, JoinRequestCourse } from '@/features/courses/types'
import { timeAgo } from '@/lib/dates'

const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })
const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

// Student → My courses: courses joined with a code, plus "Join course".
export default function StudentCoursesPage() {
  const { data, error, isLoading, refetch } = useEnrolledCoursesQuery()
  const [joining, setJoining] = useState(false)

  return (
    <div className="space-y-6">
      <PageMeta title="My courses" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My courses</h1>
          <p className="text-muted-foreground">Courses you've joined. Ask your instructor for a join code.</p>
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
        <div className={GRID}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : !data?.courses.length && !data?.requests.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BookOpen className="size-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">You haven't joined any courses yet</p>
              <p className="text-sm text-muted-foreground">Your instructor will give you a 6-character join code.</p>
            </div>
            <Button variant="outline" onClick={() => setJoining(true)}>
              <Plus aria-hidden="true" />
              Join course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.requests.length > 0 && <WaitingList requests={data.requests} />}
          {data.courses.length > 0 && (
            <div className={GRID}>
              {data.courses.map((course) => (
                <EnrolledCourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      )}

      <JoinCourseDialog open={joining} onOpenChange={setJoining} />
    </div>
  )
}

function EnrolledCourseCard({ course }: { course: EnrolledCourse }) {
  const [confirm, setConfirm] = useState(false)
  const [leave, { isLoading }] = useLeaveCourseMutation()

  const doLeave = async () => {
    try {
      await leave(course.id).unwrap()
      toast.success(`You left ${course.title}`)
      setConfirm(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="leading-snug break-words">
              <Link to={`/student/courses/${course.id}`} className="hover:underline">
                {course.title}
              </Link>
            </CardTitle>
            {course.code && (
              <Badge variant="secondary" className="mt-1.5">
                {course.code}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0" />}
              aria-label={`Actions for ${course.title}`}
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm(true)}>
                <LogOut aria-hidden="true" />
                Leave course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {course.description && (
          <CardDescription className="line-clamp-2 break-words">{course.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto grid gap-3 text-sm text-muted-foreground">
        <ProgressBar done={course.progress.done} total={course.progress.total} label={`Your progress in ${course.title}`} />
        <div>
        <p>Instructor: {course.instructorName}</p>
        <p className="text-xs">Joined {formatDate(course.joinedAt)}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Link
          to={`/student/courses/${course.id}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
          aria-label={`Open ${course.title}`}
        >
          Open course
          <ArrowRight aria-hidden="true" />
        </Link>
      </CardFooter>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {course.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need the join code from your instructor to join again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <SubmitButton
              type="button"
              variant="destructive"
              className="sm:w-auto"
              loading={isLoading}
              loadingText="Leaving…"
              onClick={() => void doLeave()}
            >
              Leave course
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// Courses the student asked to join that still need the instructor's OK.
function WaitingList({ requests }: { requests: JoinRequestCourse[] }) {
  const [cancel, { isLoading }] = useCancelJoinRequestMutation()
  const doCancel = async (r: JoinRequestCourse) => {
    try {
      await cancel(r.id).unwrap()
      toast.success(`Request to join ${r.title} cancelled`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  return (
    <section aria-labelledby="waiting-heading" className="space-y-3">
      <h2 id="waiting-heading" className="flex items-center gap-2 font-semibold">
        <Clock className="size-4" aria-hidden="true" />
        Waiting for approval
      </h2>
      <ul className="grid gap-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium break-words">
                {r.title}
                {r.code && (
                  <Badge variant="secondary" className="ml-2 align-middle">
                    {r.code}
                  </Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {r.instructorName} will approve your request · asked {timeAgo(r.requestedAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              aria-label={`Cancel request to join ${r.title}`}
              onClick={() => void doCancel(r)}
            >
              Cancel request
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
