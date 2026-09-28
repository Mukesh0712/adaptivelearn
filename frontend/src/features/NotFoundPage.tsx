import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { buttonVariants } from '@/components/ui/button'
import { ROLE_HOME, ROLE_LABEL } from '@/lib/roles'

export default function NotFoundPage() {
  const { user } = useAuth()
  const home = user ? ROLE_HOME[user.role] : '/login'

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
      <PageMeta title="Page not found" description="The page you were looking for does not exist." />
      <Compass className="size-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link to={home} replace className={buttonVariants()}>
        {user ? `Go to ${ROLE_LABEL[user.role]} portal` : 'Go to log in'}
      </Link>
    </main>
  )
}
