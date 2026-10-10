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
  r.title || (r.kind === 'video' ? `${r.provider === 'vimeo' ? 'Vimeo' : 'YouTube'} video` : hostnameOf(r.url))
