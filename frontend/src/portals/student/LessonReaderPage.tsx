import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { PageMeta } from '@/components/PageMeta'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { useLessonQuery, useSetProgressMutation } from '@/features/content/contentApi'
import { Markdown } from '@/features/content/Markdown'
import { FileCard, LinkCard, RecordingCard, VideoEmbed } from '@/features/content/Resources'
import { recordingPlatform } from '@/features/content/videoUrl'

// Student: read one published lesson, with previous/next lesson links.
export default function LessonReaderPage() {
  const { courseId = '', lessonId = '' } = useParams()
  const { data, error, isFetching, refetch } = useLessonQuery({ courseId, lessonId })
  const heading = useRef<HTMLHeadingElement>(null)
  const [setProgress, { isLoading: isSaving }] = useSetProgressMutation()
  const coursePath = `/student/courses/${courseId}`
  const lessonPath = (id: string) => `${coursePath}/lessons/${id}`
  const current = data?.lesson.id === lessonId ? data : undefined

  // On "Next", start at the top of the new lesson and move keyboard /
  // screen-reader focus to its title, as a full page load would.
  useEffect(() => {
    if (!current) return
    window.scrollTo({ top: 0 })
    heading.current?.focus()
  }, [current])

  const back = (
    <Link to={coursePath} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      {data?.course.title ?? 'Course'}
    </Link>
  )

  if (error && !isFetching) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (!current) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-64 w-full max-w-3xl rounded-xl" />
      </div>
    )
  }

  const { lesson, previous, next } = current
  const videos = lesson.resources.filter((r) => r.kind === 'video')
  const recordings = lesson.resources.filter((r) => r.kind === 'link' && recordingPlatform(r.url))
  const links = lesson.resources.filter((r) => r.kind === 'link' && !recordingPlatform(r.url))
  const files = lesson.resources.filter((r) => r.kind === 'file')
  return (
    <article className="space-y-6">
      <PageMeta title={lesson.title} />
      <div className="space-y-1">
        {back}
        <p className="text-sm text-muted-foreground">{lesson.moduleTitle}</p>
        {/* tabIndex -1: focusable by script (see above), not by Tab. */}
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight break-words outline-none">
          {lesson.title}
        </h1>
      </div>

      {videos.length > 0 && (
        <div className="grid gap-6">
          {videos.map((v) => (
            <VideoEmbed key={v.id} resource={v} />
          ))}
        </div>
      )}

      {lesson.content.trim() ? (
        <Markdown>{lesson.content}</Markdown>
      ) : (
        !videos.length && <p className="text-muted-foreground">This lesson has no text yet.</p>
      )}

      {recordings.length > 0 && (
        <section aria-labelledby="recordings-heading" className="max-w-3xl space-y-3">
          <h2 id="recordings-heading" className="text-lg font-semibold">
            Class recordings
          </h2>
          <ul className="grid gap-2">
            {recordings.map((r) => (
              <li key={r.id}>
                <RecordingCard resource={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {files.length > 0 && (
        <section aria-labelledby="files-heading" className="max-w-3xl space-y-3">
          <h2 id="files-heading" className="text-lg font-semibold">
            Files
          </h2>
          <ul className="grid gap-2">
            {files.map((f) => (
              <li key={f.id}>
                <FileCard resource={f} courseId={courseId} lessonId={lesson.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {links.length > 0 && (
        <section aria-labelledby="links-heading" className="max-w-3xl space-y-3">
          <h2 id="links-heading" className="text-lg font-semibold">
            Further reading
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {links.map((l) => (
              <li key={l.id}>
                <LinkCard resource={l} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* A toggle: aria-pressed says whether it's on; the name stays the same. */}
      <div className="flex max-w-3xl flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <Button
          variant={current.done ? 'secondary' : 'outline'}
          aria-pressed={!!current.done}
          aria-label="Mark as done"
          disabled={isSaving}
          onClick={() =>
            void setProgress({ courseId, lessonId: lesson.id, done: !current.done })
              .unwrap()
              .catch((err: unknown) => toast.error(parseApiError(err).message))
          }
          className={current.done ? 'text-emerald-800 dark:text-emerald-200' : undefined}
        >
          {current.done ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
          {current.done ? 'Done' : 'Mark as done'}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {current.done ? 'Nice work! Click again if you want to undo.' : 'Finished reading? Mark it to track your progress.'}
        </p>
      </div>

      <nav aria-label="Lessons" className="flex max-w-3xl flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        {previous ? (
          <Link to={lessonPath(previous.id)} className={buttonVariants({ variant: 'outline', className: 'h-auto justify-start py-2' })}>
            <ChevronLeft aria-hidden="true" />
            <span className="text-left">
              <span className="block text-xs text-muted-foreground">Previous</span>
              <span className="block whitespace-normal">{previous.title}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={lessonPath(next.id)} className={buttonVariants({ className: 'h-auto justify-end py-2 sm:ml-auto' })}>
            <span className="text-right">
              <span className="block text-xs">Next</span>
              <span className="block whitespace-normal">{next.title}</span>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : (
          <Link to={coursePath} className={buttonVariants({ variant: 'outline', className: 'sm:ml-auto' })}>
            Back to the course outline
          </Link>
        )}
      </nav>
    </article>
  )
}
