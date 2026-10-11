import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { CheckCircle2, Download, FileText, Link2, LoaderCircle, Plus, Trash2, Upload, Video } from 'lucide-react'
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
import {
  useAddResourceMutation,
  useDeleteResourceMutation,
  useDownloadFileMutation,
  useReorderResourcesMutation,
  useUploadFileMutation,
} from './contentApi'
import { MoveButtons } from './MoveButtons'
import { fileTypeLabel, formatBytes, moved, resourceTitle, shortUrl } from './utils'
import { FILE_EXTENSIONS, MAX_FILE_BYTES, MAX_RESOURCES, type Lesson, type Resource } from './types'
import { parseVideoUrl, PLATFORM_LABEL, PROVIDER_LABEL, recordingPlatform } from './videoUrl'

type AddKind = 'video' | 'link'
const ICON = { video: Video, link: Link2, file: FileText }
const KIND_LABEL = { video: 'Video: ', link: 'Link: ', file: 'File: ' }

// Editor section: the lesson's videos, links and files. Unlike the text,
// each change is saved straight away.
export function ResourcesEditor({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const [adding, setAdding] = useState<AddKind | null>(null)
  const [uploading, setUploading] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploadFile] = useUploadFileMutation()
  const [download] = useDownloadFileMutation()
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

  // Checks size and type here first, so a wrong file is refused at once
  // instead of after a long upload. The server checks again.
  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same file again still fires onChange
    if (!file) return
    const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? ''
    if (!FILE_EXTENSIONS.includes(ext)) {
      toast.error('This type of file is not allowed. Use PDF, Word, PowerPoint, Excel, an image, ZIP or a text file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`${file.name} is ${formatBytes(file.size)}. The limit is 10 MB.`)
      return
    }
    setUploading(file)
    try {
      toast.success((await uploadFile({ courseId, lessonId: lesson.id, file }).unwrap()).message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setUploading(null)
    }
  }

  const doDownload = (r: Resource) =>
    void download({ courseId, lessonId: lesson.id, resourceId: r.id, fileName: r.fileName ?? 'file' })
      .unwrap()
      .catch((err: unknown) => toast.error(parseApiError(err).message))

  return (
    <section aria-labelledby="resources-heading" className="grid gap-3 border-t pt-5">
      <div>
        <h2 id="resources-heading" className="text-lg font-semibold">
          Videos, links and files
        </h2>
        <p className="text-sm text-muted-foreground">
          Saved as soon as you add them{published ? ', and students see them straight away' : ''}. Videos appear above
          the lesson text; files and links below it.
        </p>
      </div>

      {resources.length > 0 && (
        <ol className="divide-y rounded-lg border" aria-label="Videos, links and files">
          {resources.map((r, i) => {
            const recording = r.kind === 'link' && recordingPlatform(r.url) !== null
            const Icon = recording ? Video : ICON[r.kind]
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">
                    <span className="sr-only">{recording ? 'Recording: ' : KIND_LABEL[r.kind]}</span>
                    {resourceTitle(r)}
                  </p>
                  {r.kind === 'file' ? (
                    <p className="text-xs text-muted-foreground">
                      {fileTypeLabel(r.fileName)} · {formatBytes(r.size)}
                    </p>
                  ) : (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-muted-foreground hover:underline"
                  >
                    {shortUrl(r.url)}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  )}
                  {r.passcode && <p className="text-xs text-muted-foreground">Passcode: {r.passcode}</p>}
                </div>
                {r.kind === 'file' && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Download ${resourceTitle(r)}`} onClick={() => doDownload(r)}>
                    <Download aria-hidden="true" />
                  </Button>
                )}
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

      {uploading && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Uploading {uploading.name} ({formatBytes(uploading.size)})…
        </p>
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
        <Button variant="outline" size="sm" disabled={full || !!uploading} onClick={() => fileInput.current?.click()}>
          <Upload aria-hidden="true" />
          Upload file
        </Button>
        {/* Hidden: the button above opens it. accept= filters the picker. */}
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          accept={FILE_EXTENSIONS.map((e) => `.${e}`).join(',')}
          onChange={(e) => void onPick(e)}
        />
        <span className="text-xs text-muted-foreground">Files: PDF, Office, images, ZIP or text, up to 10 MB.</span>
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
              It's removed from this lesson{published ? ' and students no longer see it' : ''}.
              {removing?.kind === 'file'
                ? ' The uploaded file is deleted from storage.'
                : " The video or website itself isn't affected."}
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
  kind: initialKind,
  lesson,
  courseId,
  onDone,
}: {
  kind: AddKind
  lesson: Lesson
  courseId: string
  onDone: () => void
}) {
  // Can switch from "video" to "link" when a Zoom/Teams recording is pasted.
  const [kind, setKind] = useState<AddKind>(initialKind)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [passcode, setPasscode] = useState('')
  const [errors, setErrors] = useState<{ url?: string; title?: string; passcode?: string }>({})
  const [addResource, { isLoading }] = useAddResourceMutation()
  const video = kind === 'video' ? parseVideoUrl(url) : null
  const platform = recordingPlatform(url)
  // A recording pasted as a video: explain, and offer to add it as a link.
  const recordingAsVideo = kind === 'video' && !video && platform !== null
  const isRecordingLink = kind === 'link' && platform !== null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const u = url.trim()
    if (!u) return setErrors({ url: 'Paste a link' })
    // The submit button says "Add as recording link" in that case: do just that.
    const sendKind: AddKind = recordingAsVideo ? 'link' : kind
    if (sendKind === 'video' && !video) return setErrors({ url: 'Paste a YouTube, Vimeo or Google Drive video link' })
    if (sendKind === 'link' && !/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(u)) {
      return setErrors({ url: 'Enter a full web address, starting with https://' })
    }
    try {
      const res = await addResource({
        courseId,
        lessonId: lesson.id,
        kind: sendKind,
        url: u,
        title: title.trim(),
        ...(platform === 'zoom' && passcode.trim() ? { passcode: passcode.trim() } : {}),
      }).unwrap()
      toast.success(res.message)
      onDone()
    } catch (err) {
      const { message, fields } = parseApiError(err)
      if (fields.url || fields.title || fields.passcode) {
        setErrors({ url: fields.url, title: fields.title, passcode: fields.passcode })
      } else toast.error(message)
    }
  }

  const heading = kind === 'video' ? 'Add video' : isRecordingLink ? 'Add class recording' : 'Add link'
  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
        <DialogDescription>
          {kind === 'video'
            ? 'Paste a YouTube, Vimeo or Google Drive link. Students watch it inside the lesson.'
            : isRecordingLink
              ? `Students get a "Class recording" card that opens it in ${PLATFORM_LABEL[platform]}.`
              : 'A website, article, document or Zoom/Teams recording. It opens in a new tab.'}
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
          aria-describedby={
            errors.url ? 'resource-url-error' : video || recordingAsVideo ? 'resource-url-ok' : 'resource-url-tip'
          }
          onChange={(e) => {
            setUrl(e.target.value)
            setErrors({})
          }}
        />
        <FieldError id="resource-url-error" message={errors.url} />
        {video && !errors.url && (
          <p id="resource-url-ok" className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {PROVIDER_LABEL[video.provider]} video recognised
            {video.start ? `, starts at ${Math.floor(video.start / 60)}:${String(video.start % 60).padStart(2, '0')}` : ''}
          </p>
        )}
        {recordingAsVideo && (
          <div id="resource-url-ok" role="status" className="grid gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
            <p>
              <strong>{PLATFORM_LABEL[platform]} recording.</strong> {PLATFORM_LABEL[platform]} doesn't allow its
              recordings to play inside other websites, so students will open it in {PLATFORM_LABEL[platform]}{' '}
              instead.
            </p>
            <Button type="button" size="sm" variant="secondary" className="w-fit" onClick={() => setKind('link')}>
              Add as recording link
            </Button>
          </div>
        )}
        {kind === 'video' && !video && !recordingAsVideo && (
          <p id="resource-url-tip" className="text-xs text-muted-foreground">
            Google Meet recordings are saved in Google Drive: share the file as &quot;Anyone with the link&quot; (or
            with your students), then paste its link here.
          </p>
        )}
      </div>
      {isRecordingLink && platform === 'zoom' && (
        <div className="grid gap-2">
          <Label htmlFor="resource-passcode">
            Passcode <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="resource-passcode"
            value={passcode}
            maxLength={50}
            autoComplete="off"
            placeholder="If the recording has one"
            aria-invalid={!!errors.passcode}
            aria-describedby={errors.passcode ? 'resource-passcode-error' : 'resource-passcode-help'}
            onChange={(e) => {
              setPasscode(e.target.value)
              setErrors({})
            }}
          />
          <FieldError id="resource-passcode-error" message={errors.passcode} />
          <p id="resource-passcode-help" className="text-xs text-muted-foreground">
            Shown to students of this course next to the recording, with a copy button.
          </p>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="resource-title">
          Title <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="resource-title"
          value={title}
          maxLength={150}
          placeholder={
            kind === 'video'
              ? 'e.g. Arrays explained in 10 minutes'
              : isRecordingLink
                ? 'e.g. Lecture 3 recording (12 Oct)'
                : 'e.g. Official documentation'
          }
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
          {recordingAsVideo ? 'Add as recording link' : kind === 'video' ? 'Add video' : isRecordingLink ? 'Add recording' : 'Add link'}
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
