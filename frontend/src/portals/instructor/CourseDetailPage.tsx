import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRightLeft, GraduationCap, Pencil, RefreshCw, Trash2, UserMinus, Users } from 'lucide-react'
import { useAuth } from '@/app/hooks'
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useReassignCourseMutation } from '@/features/admin/adminApi'
import { InstructorSelect } from '@/features/admin/InstructorSelect'
import { FieldError } from '@/features/auth/pages/AuthCard'
import { CourseFormDialog } from '@/features/courses/CourseFormDialog'
import { DeleteCourseDialog } from '@/features/courses/DeleteCourseDialog'
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

// One course: join code (copy / regenerate) and the class list. Shared by
// the instructor (their own course) and the admin (any course), who also
// sees who teaches it and can move it to another instructor.
export default function CourseDetailPage() {
  const { courseId = '' } = useParams()
  const { data, error, isLoading } = useCourseQuery(courseId)
  const isAdmin = useAuth().user?.role === 'admin'
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const listPath = isAdmin ? '/admin/courses' : '/instructor/courses'

  const back = (
    <Link to={listPath} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      {isAdmin ? 'Courses' : 'My courses'}
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{course.title}</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
            {course.canDelete && (
              <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {course.code && <Badge variant="secondary">{course.code}</Badge>}
          {course.status === 'archived' && <Badge variant="outline">Archived</Badge>}
        </div>
        {course.description && <p className="max-w-3xl text-muted-foreground">{course.description}</p>}
      </div>

      {isAdmin && <InstructorCard course={course} />}

      {course.status === 'active' ? (
        <JoinCodeCard course={course} />
      ) : (
        <p className="rounded-lg border bg-muted px-3 py-2 text-sm">
          This course is archived: students can't see it or join it. Restore it from {isAdmin ? 'Courses' : 'My courses'}{' '}
          to use it again.
        </p>
      )}

      <StudentsCard course={course} />

      <CourseFormDialog course={course} open={editing} onOpenChange={setEditing} />
      <DeleteCourseDialog
        course={course}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate(listPath, { replace: true })}
      />
    </div>
  )
}

// Admin only: who teaches the course, and moving it to another instructor
// (e.g. when a teacher leaves). Students and the join code stay the same.
function InstructorCard({ course }: { course: Course }) {
  const [open, setOpen] = useState(false)
  const info = course.instructorInfo
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-4" aria-hidden="true" />
          Instructor
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        {info ? (
          <div>
            <div className="flex flex-wrap items-center gap-1.5 font-medium">
              {info.name}
              {info.status && info.status !== 'active' && (
                <StatusBadge status={info.status as CourseStudent['status']} />
              )}
            </div>
            <div className="text-sm text-muted-foreground">{info.email}</div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No instructor</p>
        )}
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ArrowRightLeft aria-hidden="true" />
          Change instructor
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>{open && <ReassignForm course={course} onDone={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </Card>
  )
}

function ReassignForm({ course, onDone }: { course: Course; onDone: () => void }) {
  const [instructorId, setInstructorId] = useState('')
  const [error, setError] = useState('')
  const [reassign, { isLoading }] = useReassignCourseMutation()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!instructorId) {
      setError('Choose an instructor')
      return
    }
    try {
      toast.success((await reassign({ id: course.id, instructorId }).unwrap()).message)
      onDone()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Change instructor</DialogTitle>
        <DialogDescription>
          {course.title} moves to the new instructor's My courses. Students and the join code stay the same.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="new-instructor">New instructor</Label>
        <InstructorSelect
          id="new-instructor"
          value={instructorId}
          onChange={(id) => {
            setInstructorId(id)
            setError('')
          }}
          excludeId={course.instructorInfo?.id}
          invalid={!!error}
          describedBy={error ? 'new-instructor-error' : undefined}
        />
        <FieldError id="new-instructor-error" message={error} />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton loading={isLoading} loadingText="Moving…" className="sm:w-auto">
          Move course
        </SubmitButton>
      </DialogFooter>
    </form>
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
