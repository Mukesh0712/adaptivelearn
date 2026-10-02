import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, RefreshCw, UserMinus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { CopyButton } from '@/components/CopyButton'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/features/admin/UserBadges'
import { parseApiError } from '@/features/auth/apiError'
import {
  useCourseQuery,
  useCourseStudentsQuery,
  useRegenerateJoinCodeMutation,
  useRemoveStudentMutation,
} from '@/features/courses/coursesApi'
import { formatJoinCode } from '@/features/courses/joinCode'
import type { Course, CourseStudent } from '@/features/courses/types'

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })
const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

// Instructor → one course: join code (copy / regenerate) and the class list.
export default function CourseDetailPage() {
  const { courseId = '' } = useParams()
  const { data, error, isLoading } = useCourseQuery(courseId)

  const back = (
    <Link to="/instructor/courses" className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      My courses
    </Link>
  )

  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <CardContent className="py-6 text-center text-sm text-red-700 dark:text-red-300">
            {parseApiError(error).message}
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

  const { course } = data
  return (
    <div className="space-y-6">
      <PageMeta title={course.title} />
      <div className="space-y-2">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight break-words">{course.title}</h1>
        <div className="flex flex-wrap gap-1.5">
          {course.code && <Badge variant="secondary">{course.code}</Badge>}
          {course.status === 'archived' && <Badge variant="outline">Archived</Badge>}
        </div>
        {course.description && <p className="max-w-3xl text-muted-foreground">{course.description}</p>}
      </div>

      {course.status === 'active' ? (
        <JoinCodeCard course={course} />
      ) : (
        <p className="rounded-lg border bg-muted px-3 py-2 text-sm">
          This course is archived: students can't see it or join it. Restore it from My courses to use it again.
        </p>
      )}

      <StudentsCard course={course} />
    </div>
  )
}

function JoinCodeCard({ course }: { course: Course }) {
  const [confirm, setConfirm] = useState(false)
  const [regenerate, { isLoading }] = useRegenerateJoinCodeMutation()
  const code = formatJoinCode(course.joinCode)

  const doRegenerate = async () => {
    try {
      toast.success((await regenerate(course.id).unwrap()).message)
      setConfirm(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join code</CardTitle>
        <CardDescription>Share this with your students. They enter it under My courses → Join course.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-3xl font-semibold tracking-widest" aria-label={`Join code ${code}`}>
          {code}
        </p>
        <CopyButton value={code} label="Copy join code" successMessage="Join code copied" />
        <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => setConfirm(true)}>
          <RefreshCw aria-hidden="true" />
          New code
        </Button>
      </CardContent>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create a new join code?</AlertDialogTitle>
            <AlertDialogDescription>
              {code} will stop working. Students already in the course stay in it. Use this if the code was shared
              with people who shouldn't join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton
              type="button"
              className="sm:w-auto"
              loading={isLoading}
              loadingText="Creating…"
              onClick={() => void doRegenerate()}
            >
              Create new code
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function StudentsCard({ course }: { course: Course }) {
  const { data, error, isLoading, refetch } = useCourseStudentsQuery(course.id)
  const [removing, setRemoving] = useState<CourseStudent | null>(null)
  const [removeStudent, { isLoading: isRemoving }] = useRemoveStudentMutation()

  const doRemove = async () => {
    if (!removing) return
    try {
      await removeStudent({ courseId: course.id, studentId: removing.id }).unwrap()
      toast.success(`${removing.name} was removed from ${course.title}`)
      setRemoving(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" aria-hidden="true" />
          Students{data ? ` (${data.students.length})` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {error ? (
          <div className="flex items-center justify-between gap-2 px-4 pb-4 text-sm">
            <p className="text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-2 px-4 pb-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !data?.students.length ? (
          <p className="px-4 pb-6 text-sm text-muted-foreground">
            No students yet. Share the join code and they'll appear here as they join.
          </p>
        ) : (
          <Table>
            <TableCaption className="sr-only">Students in {course.title}, newest first</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                <TableHead className="w-px pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-4">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                      {s.name}
                      {s.status !== 'active' && <StatusBadge status={s.status} />}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDate(s.joinedAt)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${s.name} from the course`}
                      onClick={() => setRemoving(s)}
                    >
                      <UserMinus aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll no longer see {course.title}. They could join again with the current join code; create a new
              code if you don't want that.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton
              type="button"
              variant="destructive"
              className="sm:w-auto"
              loading={isRemoving}
              loadingText="Removing…"
              onClick={() => void doRemove()}
            >
              Remove
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
