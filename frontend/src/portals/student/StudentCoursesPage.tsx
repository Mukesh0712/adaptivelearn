import { useState } from 'react'
import { BookOpen, LogOut, MoreHorizontal, Plus } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { useEnrolledCoursesQuery, useLeaveCourseMutation } from '@/features/courses/coursesApi'
import { JoinCourseDialog } from '@/features/courses/JoinCourseDialog'
import type { EnrolledCourse } from '@/features/courses/types'

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
      ) : !data?.courses.length ? (
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
        <div className={GRID}>
          {data.courses.map((course) => (
            <EnrolledCourseCard key={course.id} course={course} />
          ))}
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
            <CardTitle className="leading-snug break-words">{course.title}</CardTitle>
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
      <CardContent className="mt-auto text-sm text-muted-foreground">
        <p>Instructor: {course.instructorName}</p>
        <p className="text-xs">Joined {formatDate(course.joinedAt)}</p>
      </CardContent>

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
