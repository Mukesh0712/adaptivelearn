// Turns a pasted YouTube or Vimeo link into { provider, videoId, ... }.
// Only these two sites are accepted, and only the ID is kept: the embed
// address is rebuilt from a fixed template in the browser, so a lesson can
// never put an arbitrary website inside the page.
//
// Copy of backend/src/utils/videoUrl.ts, so the form can say "that's not a
// video link" before sending. The server checks again. Keep the two in sync.

export type VideoProvider = 'youtube' | 'vimeo'

export interface VideoRef {
  provider: VideoProvider
  videoId: string
  hash?: string; // Vimeo "unlisted" videos need this extra key
  start?: number; // seconds, from ?t=90 / ?t=1m30s
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

// "90", "90s", "1m30s", "1h2m3s" → seconds.
function parseStart(value: string | null): number | undefined {
  if (!value) return undefined
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value)
  if (!m) return undefined
  const seconds = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  return seconds > 0 && seconds < 86_400 ? seconds : undefined
}

export function parseVideoUrl(input: string): VideoRef | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean)
  const start = parseStart(url.searchParams.get('t') ?? url.searchParams.get('start'))
  const withStart = (ref: VideoRef): VideoRef => (start ? { ...ref, start } : ref)

  if (host === 'youtu.be') {
    const id = parts[0] ?? ''
    return YOUTUBE_ID.test(id) ? withStart({ provider: 'youtube', videoId: id }) : null
  }
  if (YOUTUBE_HOSTS.has(host)) {
    // youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID
    const id = parts[0] === 'watch' ? url.searchParams.get('v') ?? '' : ['embed', 'shorts', 'live'].includes(parts[0] ?? '') ? parts[1] ?? '' : ''
    return YOUTUBE_ID.test(id) ? withStart({ provider: 'youtube', videoId: id }) : null
  }
  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/123, vimeo.com/123/abcdef (unlisted), vimeo.com/channels/x/123,
    // player.vimeo.com/video/123?h=abcdef
    const i = parts.findIndex((p) => /^\d{1,12}$/.test(p))
    if (i < 0) return null
    const after = parts[i + 1]
    const hash = url.searchParams.get('h') ?? (after && /^[a-f0-9]{6,20}$/i.test(after) ? after : undefined)
    const ref: VideoRef = { provider: 'vimeo', videoId: parts[i]! }
    if (hash && /^[a-f0-9]{6,20}$/i.test(hash)) ref.hash = hash.toLowerCase()
    return withStart(ref)
  }
  return null
}

// The player address. youtube-nocookie.com is YouTube's privacy-enhanced
// mode: no tracking cookies are set until the student presses play.
export function embedUrl(ref: VideoRef): string {
  if (ref.provider === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${ref.videoId}?rel=0${ref.start ? `&start=${ref.start}` : ''}`
  }
  const params = new URLSearchParams({ dnt: '1' }) // Vimeo: "do not track"
  if (ref.hash) params.set('h', ref.hash)
  return `https://player.vimeo.com/video/${ref.videoId}?${params}${ref.start ? `#t=${ref.start}s` : ''}`
}
