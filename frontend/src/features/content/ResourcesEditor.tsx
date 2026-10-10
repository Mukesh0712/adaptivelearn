import { useState, type FormEvent } from 'react'
import { CheckCircle2, Link2, Plus, Trash2, Video } from 'lucide-react'
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
import { FieldError } from '@/features/auth/pages/AuthCard'
import { parseApiError } from '@/features/auth/apiError'
import { useAddResourceMutation, useDeleteResourceMutation, useReorderResourcesMutation } from './contentApi'
import { MoveButtons } from './MoveButtons'
import { moved, resourceTitle, shortUrl } from './utils'
import { MAX_RESOURCES, type Lesson, type Resource, type ResourceKind } from './types'
import { parseVideoUrl } from './videoUrl'

// Editor section: the lesson's videos and links. Unlike the text, each
// change is saved straight away.
export function ResourcesEditor({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const [adding, setAdding] = useState<ResourceKind | null>(null)
  const [removing, setRemoving] = useState<Resource | null>(null)
  const [deleteResource, { isLoading: isRemoving }] = useDeleteResourceMutation()
  const [reorder] = useReorderResourcesMutation()
  const resources = lesson.resources
  const full = resources.length >= MAX_RESOURCES
  const published = lesson.status === 'published'

  const doRemove = async () => {
    if (!removing) return
    try {
      toast.success((await deleteResource({ courseId, lessonId: lesson.id, resourceId: removing.id }).unwrap()).message)
      setRemoving(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <section aria-labelledby="resources-heading" className="grid gap-3 border-t pt-5">
      <div>
        <h2 id="resources-heading" className="text-lg font-semibold">
          Videos and links
        </h2>
        <p className="text-sm text-muted-foreground">
          Saved as soon as you add them{published ? ', and students see them straight away' : ''}. Videos appear above
          the lesson text, links below it.
        </p>
      </div>

      {resources.length > 0 && (
        <ol className="divide-y rounded-lg border" aria-label="Videos and links">
          {resources.map((r, i) => {
            const Icon = r.kind === 'video' ? Video : Link2
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">
                    <span className="sr-only">{r.kind === 'video' ? 'Video: ' : 'Link: '}</span>
                    {resourceTitle(r)}
                  </p>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-muted-foreground hover:underline"
                  >
                    {shortUrl(r.url)}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
                <MoveButtons
                  label={resourceTitle(r)}
                  index={i}
                  count={resources.length}
                  onMove={(by) =>
                    void reorder({ courseId, lessonId: lesson.id, ids: moved(resources.map((x) => x.id), i, by) })
                      .unwrap()
                      .catch((err: unknown) => toast.error(parseApiError(err).message))
                  }
                />
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${resourceTitle(r)}`} onClick={() => setRemoving(r)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={full} onClick={() => setAdding('video')}>
          <Video aria-hidden="true" />
          Add video
        </Button>
        <Button variant="outline" size="sm" disabled={full} onClick={() => setAdding('link')}>
          <Link2 aria-hidden="true" />
          Add link
        </Button>
        {full && <p className="text-sm text-muted-foreground">Limit reached: {MAX_RESOURCES} per lesson.</p>}
      </div>

      <Dialog open={!!adding} onOpenChange={(open) => !open && setAdding(null)}>
        <DialogContent className="sm:max-w-md">
          {adding && <AddResourceForm kind={adding} lesson={lesson} courseId={courseId} onDone={() => setAdding(null)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing ? resourceTitle(removing) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              It's removed from this lesson{published ? ' and students no longer see it' : ''}. The video or website
              itself isn't affected.
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
    </section>
  )
}

function AddResourceForm({
  kind,
  lesson,
  courseId,
  onDone,
}: {
  kind: ResourceKind
  lesson: Lesson
  courseId: string
  onDone: () => void
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [errors, setErrors] = useState<{ url?: string; title?: string }>({})
  const [addResource, { isLoading }] = useAddResourceMutation()
  const video = kind === 'video' ? parseVideoUrl(url) : null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const u = url.trim()
    if (!u) return setErrors({ url: 'Paste a link' })
    if (kind === 'video' && !video) return setErrors({ url: 'Paste a YouTube or Vimeo video link' })
    if (kind === 'link' && !/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(u)) {
      return setErrors({ url: 'Enter a full web address, starting with https://' })
    }
    try {
      const res = await addResource({ courseId, lessonId: lesson.id, kind, url: u, title: title.trim() }).unwrap()
      toast.success(res.message)
      onDone()
    } catch (err) {
      const { message, fields } = parseApiError(err)
      if (fields.url || fields.title) setErrors({ url: fields.url, title: fields.title })
      else toast.error(message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{kind === 'video' ? 'Add video' : 'Add link'}</DialogTitle>
        <DialogDescription>
          {kind === 'video'
            ? 'Paste a YouTube or Vimeo link. Students watch it inside the lesson.'
            : 'A website, article or document that helps with this lesson. It opens in a new tab.'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="resource-url">{kind === 'video' ? 'Video link' : 'Web address'}</Label>
        <Input
          id="resource-url"
          type="url"
          inputMode="url"
          autoFocus
          value={url}
          maxLength={2000}
          placeholder={kind === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://'}
          aria-invalid={!!errors.url}
          aria-describedby={errors.url ? 'resource-url-error' : video ? 'resource-url-ok' : undefined}
          onChange={(e) => {
            setUrl(e.target.value)
            setErrors({})
          }}
        />
        <FieldError id="resource-url-error" message={errors.url} />
        {video && !errors.url && (
          <p id="resource-url-ok" className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {video.provider === 'youtube' ? 'YouTube' : 'Vimeo'} video recognised
            {video.start ? `, starts at ${Math.floor(video.start / 60)}:${String(video.start % 60).padStart(2, '0')}` : ''}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="resource-title">
          Title <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="resource-title"
          value={title}
          maxLength={150}
          placeholder={kind === 'video' ? 'e.g. Arrays explained in 10 minutes' : 'e.g. Official documentation'}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'resource-title-error' : undefined}
          onChange={(e) => {
            setTitle(e.target.value)
            setErrors({})
          }}
        />
        <FieldError id="resource-title-error" message={errors.title} />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton loading={isLoading} loadingText="Adding…" className="sm:w-auto">
          <Plus aria-hidden="true" />
          {kind === 'video' ? 'Add video' : 'Add link'}
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
