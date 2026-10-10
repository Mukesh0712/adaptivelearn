import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FileText, Layers, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import {
  useCourseContentQuery,
  useCreateLessonMutation,
  useCreateModuleMutation,
  useDeleteModuleMutation,
  useRenameModuleMutation,
  useReorderLessonsMutation,
  useReorderModulesMutation,
} from './contentApi'
import { LessonStatusBadge } from './LessonStatusBadge'
import { MoveButtons } from './MoveButtons'
import { moved } from './utils'
import { TitleDialog } from './TitleDialog'
import { LESSON_TITLE_MAX, MODULE_TITLE_MAX, type OutlineModule } from './types'

type DialogState =
  | { kind: 'addModule' }
  | { kind: 'rename'; module: OutlineModule }
  | { kind: 'addLesson'; module: OutlineModule }
  | null

// The course's modules and lessons, on the course page (instructor and
// admin). Add, rename, reorder and delete modules; add and reorder lessons.
// A lesson's text is written on its own editor page.
export function ContentCard({ courseId, basePath }: { courseId: string; basePath: '/instructor' | '/admin' }) {
  const { data, error, isLoading, refetch } = useCourseContentQuery(courseId)
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [deleting, setDeleting] = useState<OutlineModule | null>(null)
  const [createModule] = useCreateModuleMutation()
  const [renameModule] = useRenameModuleMutation()
  const [createLesson] = useCreateLessonMutation()
  const [deleteModule, { isLoading: isDeleting }] = useDeleteModuleMutation()
  const [reorderModules] = useReorderModulesMutation()
  const [reorderLessons] = useReorderLessonsMutation()

  const modules = data?.modules ?? []
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0)
  const publishedCount = modules.reduce((n, m) => n + m.lessons.filter((l) => l.status === 'published').length, 0)
  const lessonPath = (lessonId: string) => `${basePath}/courses/${courseId}/lessons/${lessonId}`

  const report = (promise: Promise<unknown>) =>
    promise.catch((err: unknown) => toast.error(parseApiError(err).message))

  const doDeleteModule = async () => {
    if (!deleting) return
    try {
      toast.success((await deleteModule({ courseId, moduleId: deleting.id }).unwrap()).message)
      setDeleting(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-4" aria-hidden="true" />
          Content
        </CardTitle>
        <CardDescription>
          {modules.length
            ? `${modules.length} ${modules.length === 1 ? 'module' : 'modules'} · ${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'} (${publishedCount} published). Students see published lessons only.`
            : 'Organise the course into modules, each with its lessons.'}
        </CardDescription>
        {!!modules.length && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'addModule' })}>
              <Plus aria-hidden="true" />
              Add module
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <p className="text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !modules.length ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-center">
            <Layers className="size-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">No content yet</p>
              <p className="text-sm text-muted-foreground">
                Start with a module, for example "Week 1" or "Unit 1: Introduction".
              </p>
            </div>
            <Button onClick={() => setDialog({ kind: 'addModule' })}>
              <Plus aria-hidden="true" />
              Add module
            </Button>
          </div>
        ) : (
          <ol className="grid gap-4" aria-label="Modules">
            {modules.map((mod, mi) => (
              <li key={mod.id} className="rounded-lg border">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                  <h3 className="min-w-0 flex-1 font-medium break-words">
                    <span className="text-muted-foreground">Module {mi + 1}:</span> {mod.title}
                  </h3>
                  <MoveButtons
                    label={`module ${mod.title}`}
                    index={mi}
                    count={modules.length}
                    onMove={(by) =>
                      void report(
                        reorderModules({ courseId, ids: moved(modules.map((m) => m.id), mi, by) }).unwrap(),
                      )
                    }
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" />}
                      aria-label={`Actions for module ${mod.title}`}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setDialog({ kind: 'addLesson', module: mod })}>
                        <Plus aria-hidden="true" />
                        Add lesson
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ kind: 'rename', module: mod })}>
                        <Pencil aria-hidden="true" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleting(mod)}>
                        <Trash2 aria-hidden="true" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {mod.lessons.length > 0 && (
                  <ol className="divide-y" aria-label={`Lessons in ${mod.title}`}>
                    {mod.lessons.map((lesson, li) => (
                      <li key={lesson.id} className="flex items-center gap-2 px-3 py-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <Link
                          to={lessonPath(lesson.id)}
                          className="min-w-0 flex-1 text-sm break-words hover:underline"
                        >
                          {lesson.title}
                        </Link>
                        <LessonStatusBadge status={lesson.status} />
                        <MoveButtons
                          label={`lesson ${lesson.title}`}
                          index={li}
                          count={mod.lessons.length}
                          onMove={(by) =>
                            void report(
                              reorderLessons({
                                courseId,
                                moduleId: mod.id,
                                ids: moved(mod.lessons.map((l) => l.id), li, by),
                              }).unwrap(),
                            )
                          }
                        />
                      </li>
                    ))}
                  </ol>
                )}
                <div className="px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2"
                    onClick={() => setDialog({ kind: 'addLesson', module: mod })}
                  >
                    <Plus aria-hidden="true" />
                    Add lesson<span className="sr-only"> to {mod.title}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <TitleDialog
        open={dialog?.kind === 'addModule'}
        onOpenChange={(open) => !open && setDialog(null)}
        heading="Add module"
        description="A module groups related lessons, such as one week or one unit. It's added at the end."
        label="Module title"
        submitText="Add module"
        maxLength={MODULE_TITLE_MAX}
        onSubmit={async (title) => toast.success((await createModule({ courseId, title }).unwrap()).message)}
      />
      <TitleDialog
        open={dialog?.kind === 'rename'}
        onOpenChange={(open) => !open && setDialog(null)}
        heading="Rename module"
        description="Students see the new name straight away."
        label="Module title"
        submitText="Save"
        maxLength={MODULE_TITLE_MAX}
        initial={dialog?.kind === 'rename' ? dialog.module.title : ''}
        onSubmit={async (title) => {
          if (dialog?.kind !== 'rename') return
          toast.success((await renameModule({ courseId, moduleId: dialog.module.id, title }).unwrap()).message)
        }}
      />
      <TitleDialog
        open={dialog?.kind === 'addLesson'}
        onOpenChange={(open) => !open && setDialog(null)}
        heading={dialog?.kind === 'addLesson' ? `Add lesson to ${dialog.module.title}` : 'Add lesson'}
        description="The lesson starts as a draft. You'll write it next, then publish it when it's ready."
        label="Lesson title"
        submitText="Create and write"
        maxLength={LESSON_TITLE_MAX}
        onSubmit={async (title) => {
          if (dialog?.kind !== 'addLesson') return
          const res = await createLesson({ courseId, moduleId: dialog.module.id, title }).unwrap()
          toast.success(res.message)
          void navigate(lessonPath(res.lesson.id))
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete module {deleting?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.lessons.length
                ? `It still has ${deleting.lessons.length} ${deleting.lessons.length === 1 ? 'lesson' : 'lessons'}. Delete or move ${deleting.lessons.length === 1 ? 'it' : 'them'} first, so no lesson is lost by accident.`
                : 'The module is empty. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{deleting?.lessons.length ? 'OK' : 'Cancel'}</AlertDialogCancel>
            {!deleting?.lessons.length && (
              <SubmitButton
                type="button"
                variant="destructive"
                className="sm:w-auto"
                loading={isDeleting}
                loadingText="Deleting…"
                onClick={() => void doDeleteModule()}
              >
                Delete module
              </SubmitButton>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
