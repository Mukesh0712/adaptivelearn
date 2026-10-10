import { useEffect, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Eye, EyeOff, Pencil, Save, Send, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/hooks'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { FieldError } from '@/features/auth/pages/AuthCard'
import { parseApiError } from '@/features/auth/apiError'
import { formatDateTime } from '@/lib/dates'
import { useDeleteLessonMutation, useLessonQuery, useUpdateLessonMutation } from './contentApi'
import { LessonStatusBadge } from './LessonStatusBadge'
import { Markdown } from './Markdown'
import { LESSON_CONTENT_MAX, LESSON_TITLE_MAX, type Lesson, type LessonStatus } from './types'

// Instructor/admin: write one lesson in Markdown, preview it, publish it.
// Route: /{instructor|admin}/courses/:courseId/lessons/:lessonId
export default function LessonEditorPage() {
  const { courseId = '', lessonId = '' } = useParams()
  const isAdmin = useAuth().user?.role === 'admin'
  const coursePath = `${isAdmin ? '/admin' : '/instructor'}/courses/${courseId}`
  const { data, error, isLoading } = useLessonQuery({ courseId, lessonId })

  const back = (
    <Link to={coursePath} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      {data?.course.title ?? 'Course'}
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
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }
  // key: opening another lesson starts a fresh editor with its own text.
  return <Editor key={data.lesson.id} lesson={data.lesson} courseId={courseId} coursePath={coursePath} back={back} />
}

function Editor({
  lesson,
  courseId,
  coursePath,
  back,
}: {
  lesson: Lesson
  courseId: string
  coursePath: string
  back: React.ReactNode
}) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(lesson.title)
  const [content, setContent] = useState(lesson.content)
  // What the server has: "unsaved changes" means the fields differ from it.
  const [saved, setSaved] = useState({ title: lesson.title, content: lesson.content })
  const [titleError, setTitleError] = useState('')
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [updateLesson, { isLoading: isSaving }] = useUpdateLessonMutation()
  const [deleteLesson, { isLoading: isDeleting }] = useDeleteLessonMutation()
  const dirty = title !== saved.title || content !== saved.content
  const published = lesson.status === 'published'

  // Warn before leaving with unsaved changes: closing the tab or reloading
  // (beforeunload, the browser's own prompt) and in-app links (useBlocker).
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  // Saves the text, and optionally changes the status in the same request.
  const save = async (status?: LessonStatus) => {
    const t = title.trim()
    if (t.length < 2) {
      setTitleError('Title must be at least 2 characters')
      return false
    }
    try {
      const res = await updateLesson({ courseId, lessonId: lesson.id, title: t, content, ...(status ? { status } : {}) }).unwrap()
      setTitle(t)
      setSaved({ title: t, content })
      toast.success(res.message)
      return true
    } catch (err) {
      const { message, fields } = parseApiError(err)
      if (fields.title) setTitleError(fields.title)
      toast.error(fields.content ?? message)
      return false
    }
  }

  // Ctrl+S / Cmd+S saves instead of opening the browser's "Save page".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty && !isSaving) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const doDelete = async () => {
    try {
      const res = await deleteLesson({ courseId, lessonId: lesson.id }).unwrap()
      toast.success(res.message)
      setSaved({ title, content }) // nothing left to warn about
      setConfirmDelete(false)
      // After the state update, so the unsaved-changes blocker sees "clean".
      setTimeout(() => void navigate(coursePath, { replace: true }))
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <div className="space-y-5">
      <PageMeta title={`Edit: ${lesson.title}`} />
      <div className="space-y-2">
        {back}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Edit lesson</h1>
          <LessonStatusBadge status={lesson.status} />
          {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          Module: {lesson.moduleTitle}
          {published && lesson.publishedAt ? ` · Published ${formatDateTime(lesson.publishedAt)}` : ''}
        </p>
      </div>

      <div className="grid max-w-xl gap-2">
        <Label htmlFor="lesson-title">Title</Label>
        <Input
          id="lesson-title"
          value={title}
          maxLength={LESSON_TITLE_MAX}
          aria-invalid={!!titleError}
          aria-describedby={titleError ? 'lesson-title-error' : undefined}
          onChange={(e) => {
            setTitle(e.target.value)
            setTitleError('')
          }}
        />
        <FieldError id="lesson-title-error" message={titleError} />
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Label htmlFor="lesson-content">Lesson text</Label>
          {/* Two toggle buttons; aria-pressed tells screen readers which is on. */}
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Editor view">
            <Button size="sm" variant={preview ? 'ghost' : 'secondary'} aria-pressed={!preview} onClick={() => setPreview(false)}>
              <Pencil aria-hidden="true" />
              Write
            </Button>
            <Button size="sm" variant={preview ? 'secondary' : 'ghost'} aria-pressed={preview} onClick={() => setPreview(true)}>
              <Eye aria-hidden="true" />
              Preview
            </Button>
          </div>
        </div>
        {preview ? (
          <div className="min-h-80 rounded-lg border px-4 py-3" aria-label="Preview of the lesson text">
            {content.trim() ? <Markdown>{content}</Markdown> : <p className="text-sm text-muted-foreground">Nothing written yet.</p>}
          </div>
        ) : (
          <Textarea
            id="lesson-content"
            value={content}
            maxLength={LESSON_CONTENT_MAX}
            onChange={(e) => setContent(e.target.value)}
            aria-describedby="lesson-content-help"
            className="min-h-80 font-mono text-sm leading-6 md:text-sm"
            placeholder={'## Introduction\n\nWrite the lesson here. Use **bold**, *italics*, lists and [links](https://example.com).'}
          />
        )}
        <div id="lesson-content-help" className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Formatting: <code>## Heading</code>, <code>**bold**</code>, <code>*italic*</code>, <code>- list</code>,{' '}
            <code>1. list</code>, <code>[text](https://link)</code>, <code>`code`</code>, tables.
          </span>
          <span>
            {content.length.toLocaleString('en-IN')} / {LESSON_CONTENT_MAX.toLocaleString('en-IN')} characters
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <SubmitButton
          type="button"
          className="sm:w-auto"
          loading={isSaving}
          loadingText="Saving…"
          disabled={!dirty || isSaving}
          onClick={() => void save()}
        >
          <Save aria-hidden="true" />
          Save
        </SubmitButton>
        {published ? (
          <Button variant="outline" disabled={isSaving} onClick={() => void save('draft')}>
            <EyeOff aria-hidden="true" />
            Move to draft
          </Button>
        ) : (
          <Button variant="outline" disabled={isSaving} onClick={() => void save('published')}>
            <Send aria-hidden="true" />
            {dirty ? 'Save and publish' : 'Publish'}
          </Button>
        )}
        <Button variant="ghost" className="text-red-700 hover:text-red-800 dark:text-red-300 sm:ml-auto" onClick={() => setConfirmDelete(true)}>
          <Trash2 aria-hidden="true" />
          Delete lesson
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {lesson.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              {published ? 'Students will no longer see it. ' : ''}The lesson and its text are removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton
              type="button"
              variant="destructive"
              className="sm:w-auto"
              loading={isDeleting}
              loadingText="Deleting…"
              onClick={() => void doDelete()}
            >
              Delete lesson
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocker.state === 'blocked'} onOpenChange={(open) => !open && blocker.reset?.()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your changes to this lesson haven't been saved and will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Undo2 aria-hidden="true" />
              Keep editing
            </AlertDialogCancel>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Leave without saving
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
