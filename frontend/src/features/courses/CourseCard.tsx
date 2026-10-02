import { useState } from 'react'
import { Link } from 'react-router'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { CopyButton } from '@/components/CopyButton'
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { parseApiError } from '@/features/auth/apiError'
import { cn } from '@/lib/utils'
import { CourseFormDialog } from './CourseFormDialog'
import { DeleteCourseDialog } from './DeleteCourseDialog'
import { useSetCourseStatusMutation } from './coursesApi'
import { formatJoinCode } from './joinCode'
import type { Course } from './types'

// One course on the instructor's "My courses" page.
export function CourseCard({ course }: { course: Course }) {
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [setStatus, { isLoading }] = useSetCourseStatusMutation()
  const archived = course.status === 'archived'

  const changeStatus = async (status: Course['status']) => {
    try {
      toast.success((await setStatus({ id: course.id, status }).unwrap()).message)
      setConfirmArchive(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Card className={cn('gap-3', archived && 'bg-muted/50')}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="leading-snug break-words">
              {/* The whole title is the link to the course page. */}
              <Link to={`/instructor/courses/${course.id}`} className="hover:underline">
                {course.title}
              </Link>
            </CardTitle>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {course.code && <Badge variant="secondary">{course.code}</Badge>}
              {archived && <Badge variant="outline">{course.archivedByAdmin ? 'Archived by admin' : 'Archived'}</Badge>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1 shrink-0" />}
              aria-label={`Actions for ${course.title}`}
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              {archived ? (
                // A course an admin archived can only be restored by an admin.
                <DropdownMenuItem disabled={course.archivedByAdmin} onClick={() => void changeStatus('active')}>
                  <ArchiveRestore aria-hidden="true" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setConfirmArchive(true)}>
                  <Archive aria-hidden="true" />
                  Archive
                </DropdownMenuItem>
              )}
              {/* Only offered for a course nobody ever joined. */}
              {course.canDelete && (
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {course.description && (
          <CardDescription className="line-clamp-2 break-words">{course.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="mt-auto space-y-2">
        {course.archivedByAdmin && (
          <p className="text-sm">An administrator archived this course. Contact them to restore it.</p>
        )}
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden="true" />
          {course.studentCount ?? 0} {course.studentCount === 1 ? 'student' : 'students'}
        </p>
      </CardContent>

      {!archived && (
        <CardFooter className="justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Join code</p>
            <p className="font-mono text-lg font-semibold tracking-wider">{formatJoinCode(course.joinCode)}</p>
          </div>
          <CopyButton
            value={formatJoinCode(course.joinCode)}
            label={`Copy join code for ${course.title}`}
            successMessage="Join code copied"
          />
        </CardFooter>
      )}

      <CourseFormDialog course={course} open={editing} onOpenChange={setEditing} />
      <DeleteCourseDialog course={course} open={confirmDelete} onOpenChange={setConfirmDelete} />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {course.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Students will no longer see this course or be able to join it. Nothing is deleted, and you can restore
              it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton
              type="button"
              className="sm:w-auto"
              loading={isLoading}
              loadingText="Archiving…"
              onClick={() => void changeStatus('archived')}
            >
              Archive
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
