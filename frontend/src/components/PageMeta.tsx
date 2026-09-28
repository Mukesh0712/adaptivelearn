import { SITE } from '@/config/site'

// Per-page <title> and description. React 19 automatically moves these tags
// into <head>, replacing the defaults from index.html while the page is shown.
export function PageMeta({ title, description = SITE.description }: { title: string; description?: string }) {
  const fullTitle = `${title} · ${SITE.name}`
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
    </>
  )
}
