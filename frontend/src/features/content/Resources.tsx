import { Download, ExternalLink, FileText, LoaderCircle, Video } from 'lucide-react'
import { CopyButton } from '@/components/CopyButton'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { parseApiError } from '@/features/auth/apiError'
import { useDownloadFileMutation } from './contentApi'
import type { Resource } from './types'
import { fileTypeLabel, formatBytes, resourceTitle, shortUrl } from './utils'
import { embedUrl, PLATFORM_LABEL, recordingPlatform } from './videoUrl'

// A lesson video, 16:9 at any width.
//  - The address comes from the stored video ID (embedUrl), never from the
//    pasted link, and the Content-Security-Policy only allows these players.
//  - Google Drive files may need the student to sign in to Google, which
//    can't happen inside the frame, so a "Open in Google Drive" link is shown too.
//  - sandbox: the player may run its own scripts, but may not navigate this
//    page away or submit forms in it.
//  - referrerPolicy: YouTube refuses to play embeds that send no referrer,
//    and the rest of the site sends none (helmet's no-referrer default).
export function VideoEmbed({ resource }: { resource: Resource }) {
  if (!resource.provider || !resource.videoId) return null
  const title = resourceTitle(resource)
  return (
    <figure className="max-w-3xl">
      <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
        <iframe
          src={embedUrl({ provider: resource.provider, videoId: resource.videoId, hash: resource.hash, start: resource.start })}
          title={`Video: ${title}`}
          className="size-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
      {(resource.title || resource.provider === 'gdrive') && (
        <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {resource.title && <span>{resource.title}</span>}
          {resource.provider === 'gdrive' && (
            <a
              href={`https://drive.google.com/file/d/${resource.videoId}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Not playing? Open in Google Drive
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </figcaption>
      )}
    </figure>
  )
}

// A link to another website, shown as a card. Opens in a new tab.
export function LinkCard({ resource }: { resource: Resource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted"
    >
      <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-medium break-words">{resourceTitle(resource)}</span>
        <span className="block truncate text-sm text-muted-foreground">{shortUrl(resource.url)}</span>
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

// A lesson file for students: name, type and size, and a Download button.
export function FileCard({ resource, courseId, lessonId }: { resource: Resource; courseId: string; lessonId: string }) {
  const [download, { isLoading }] = useDownloadFileMutation()
  const title = resourceTitle(resource)
  const onDownload = () =>
    void download({ courseId, lessonId, resourceId: resource.id, fileName: resource.fileName ?? 'file' })
      .unwrap()
      .catch((err: unknown) => toast.error(parseApiError(err).message))

  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{title}</p>
        <p className="text-sm text-muted-foreground">
          {fileTypeLabel(resource.fileName)} · {formatBytes(resource.size)}
        </p>
      </div>
      <Button variant="outline" size="sm" disabled={isLoading} aria-label={`Download ${title}`} onClick={onDownload}>
        {isLoading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        <span className="hidden sm:inline">{isLoading ? 'Downloading…' : 'Download'}</span>
      </Button>
    </div>
  )
}

// A Zoom / Teams class recording: those sites can't be shown inside the
// lesson, so it's a card that opens the recording there (plus the Zoom
// passcode, if the instructor added one).
export function RecordingCard({ resource }: { resource: Resource }) {
  const platform = recordingPlatform(resource.url)
  const name = platform ? PLATFORM_LABEL[platform] : 'the original site'
  return (
    <div className="grid gap-2 rounded-lg border px-4 py-3">
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3"
      >
        <Video className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium break-words group-hover:underline">{resourceTitle(resource)}</span>
          <span className="block text-sm text-muted-foreground">
            {name} recording · opens in {name}
          </span>
        </span>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {resource.passcode && (
        <div className="flex flex-wrap items-center gap-2 pl-8 text-sm">
          <span className="text-muted-foreground">Passcode:</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{resource.passcode}</code>
          <CopyButton value={resource.passcode} label="Copy passcode" successMessage="Passcode copied" />
        </div>
      )}
    </div>
  )
}
