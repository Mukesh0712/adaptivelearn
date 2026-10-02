import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { Button, buttonVariants } from '@/components/ui/button'
import { ROLE_HOME } from '@/lib/roles'
import { cn } from '@/lib/utils'

// After a new deployment, the old page's code files (with old hashed names)
// no longer exist on the server, so opening a lazily loaded page fails with
// an error like this one. Reloading fetches the new version and fixes it.
const isChunkLoadError = (error: unknown) =>
  error instanceof Error &&
  /dynamically imported module|Importing a module script failed|Failed to fetch module/i.test(error.message)

const RELOAD_KEY = 'chunk-reload-at'

// Shown instead of React Router's default "Unexpected Application Error"
// screen when a page throws while rendering or loading.
//  - inLayout: the error stays inside the portal (sidebar and header remain),
//    so the user can simply click to another page.
//  - otherwise it fills the whole screen (e.g. an error on a public page).
export function RouteError({ inLayout = false }: { inLayout?: boolean }) {
  const error = useRouteError()
  const { user } = useAuth()
  const chunkError = isChunkLoadError(error)

  useEffect(() => {
    console.error(error)
    if (!chunkError) return
    // Reload once to pick up the new deployment. The timestamp check stops an
    // endless reload loop if the file is really missing.
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
        window.location.reload()
      }
    } catch {
      // sessionStorage blocked: just show the message below.
    }
  }, [error, chunkError])

  const title = chunkError
    ? 'A new version is available'
    : isRouteErrorResponse(error) && error.status === 404
      ? 'Page not found'
      : 'Something went wrong'
  const message = chunkError
    ? 'AdaptiveLearn was updated while this page was open. Reload to get the latest version.'
    : "This page ran into an unexpected problem. Your data is safe. Try again, or go back to your dashboard."
  const home = user ? ROLE_HOME[user.role] : '/login'

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 p-6 text-center',
        inLayout ? 'min-h-[60vh]' : 'min-h-svh bg-muted',
      )}
    >
      <PageMeta title={title} />
      <TriangleAlert className="size-10 text-amber-600" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-muted-foreground">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden="true" />
          {chunkError ? 'Reload' : 'Try again'}
        </Button>
        <Link to={home} reloadDocument className={buttonVariants({ variant: 'outline' })}>
          {user ? 'Go to dashboard' : 'Go to log in'}
        </Link>
      </div>
      {/* Developers see the technical details; real users never do. */}
      {import.meta.env.DEV && error instanceof Error && (
        <details className="mt-2 w-full max-w-2xl text-left text-xs">
          <summary className="cursor-pointer text-muted-foreground">Technical details (development only)</summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 whitespace-pre-wrap">
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  )
}
