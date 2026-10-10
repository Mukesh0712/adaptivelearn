// Small helpers shared by the content components.
import type { Resource } from './types'

// Moves one id up or down in a list, giving the complete new order.
export function moved(ids: string[], index: number, by: -1 | 1) {
  const next = [...ids]
  ;[next[index], next[index + by]] = [next[index + by]!, next[index]!]
  return next
}

export const hostnameOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// "https://www.site.com/page" → "site.com/page", for showing an address.
export const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')

// What to call a resource when the instructor gave it no title.
export const resourceTitle = (r: Resource) =>
  r.title ||
  (r.kind === 'video'
    ? `${r.provider === 'vimeo' ? 'Vimeo' : 'YouTube'} video`
    : r.kind === 'file'
      ? (r.fileName ?? 'File')
      : hostnameOf(r.url))

// 2_400_000 → "2.3 MB"
export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// "Unit 1.PDF" → "PDF"
export const fileTypeLabel = (name = '') => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toUpperCase() ?? 'FILE'

// Saves downloaded bytes under the given name (a temporary link, clicked).
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
