// Date helpers shared by lists and dashboards. Each one checks the date is
// valid first: formatting an invalid date throws and would crash the page.

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const toDate = (iso?: string | null) => {
  const date = iso ? new Date(iso) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

// "2 Oct 2026"
export const formatDate = (iso?: string | null) => {
  const date = toDate(iso)
  return date ? dateFormat.format(date) : ''
}

// "2 Oct 2026, 1:34 pm"
export const formatDateTime = (iso?: string | null) => {
  const date = toDate(iso)
  return date ? dateTimeFormat.format(date) : ''
}

// "5 minutes ago", "yesterday", …
export function timeAgo(iso?: string | null): string {
  const date = toDate(iso)
  if (!date) return ''
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
