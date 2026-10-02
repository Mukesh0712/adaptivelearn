import { toast } from 'sonner'
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
import { parseApiError } from '@/features/auth/apiError'
import { useDeleteCourseMutation } from './coursesApi'

// Confirms deleting a course nobody ever joined. (The server refuses anything
// with history; such courses can only be archived.)
export function DeleteCourseDialog({
  course,
  open,
  onOpenChange,
  onDeleted,
}: {
  course: { id: string; title: string }
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}) {
  const [deleteCourse, { isLoading }] = useDeleteCourseMutation()

  const confirm = async () => {
    try {
      toast.success((await deleteCourse(course.id).unwrap()).message)
      onOpenChange(false)
      onDeleted?.()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {course.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            Nobody has joined this course, so it can be deleted permanently. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <SubmitButton
            type="button"
            variant="destructive"
            className="sm:w-auto"
            loading={isLoading}
            loadingText="Deleting…"
            onClick={() => void confirm()}
          >
            Delete course
          </SubmitButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
