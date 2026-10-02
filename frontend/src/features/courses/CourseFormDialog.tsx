import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { SubmitButton } from '@/components/SubmitButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FieldError, FormError } from '@/features/auth/pages/AuthCard'
import { useAuthForm } from '@/features/auth/useAuthForm'
import { useCreateCourseMutation, useUpdateCourseMutation } from './coursesApi'
import { courseSchema } from './schemas'
import type { Course } from './types'

// Create a course (no `course` given) or edit one. Controlled by the parent,
// so it can be opened from a button or from a card's menu.
export function CourseFormDialog({
  course,
  open,
  onOpenChange,
}: {
  course?: Course
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so the form starts fresh every time. */}
        {open && <CourseForm course={course} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CourseForm({ course, onDone }: { course?: Course; onDone: () => void }) {
  const [createCourse, create] = useCreateCourseMutation()
  const [updateCourse, update] = useUpdateCourseMutation()
  const isLoading = create.isLoading || update.isLoading
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } = useAuthForm(
    courseSchema,
    { title: course?.title ?? '', code: course?.code ?? '', description: course?.description ?? '' },
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const body = { title: values.title.trim(), code: values.code.trim(), description: values.description.trim() }
    try {
      const res = course ? await updateCourse({ id: course.id, ...body }).unwrap() : await createCourse(body).unwrap()
      toast.success(res.message)
      onDone()
    } catch (err) {
      handleServerError(err)
    }
  }

  return (
    <form onSubmit={handleSubmit} method="post" className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{course ? 'Edit course' : 'New course'}</DialogTitle>
        <DialogDescription>
          {course
            ? 'Changes are visible to enrolled students right away.'
            : 'A join code is created automatically. Share it with your students so they can join.'}
        </DialogDescription>
      </DialogHeader>
      <FormError message={formError} />

      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          {...fieldProps('title')}
          name="title"
          autoComplete="off"
          autoFocus
          placeholder="e.g. Data Structures"
          maxLength={120}
          value={values.title}
          onChange={(e) => setField('title', e.target.value)}
        />
        <FieldError id="title-error" message={errors.title} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="code">
          Course code <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          {...fieldProps('code')}
          name="code"
          autoComplete="off"
          placeholder="e.g. CS201"
          maxLength={20}
          value={values.code}
          onChange={(e) => setField('code', e.target.value)}
          className="uppercase placeholder:normal-case"
        />
        <FieldError id="code-error" message={errors.code} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          {...fieldProps('description')}
          aria-describedby={errors.description ? 'description-error' : 'description-count'}
          name="description"
          rows={3}
          maxLength={1000}
          placeholder="What will students learn?"
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          className="max-h-48"
        />
        {errors.description ? (
          <FieldError id="description-error" message={errors.description} />
        ) : (
          <p id="description-count" className="text-right text-xs text-muted-foreground">
            {values.description.length}/1000
          </p>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton loading={isLoading} loadingText="Saving…" className="sm:w-auto">
          {course ? 'Save changes' : 'Create course'}
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
