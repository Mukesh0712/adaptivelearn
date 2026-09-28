import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { SITE } from '@/config/site'

// Privacy / Terms links shown under the auth pages and in the sidebar.
export function SiteFooterLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      <span>© {new Date().getFullYear()} {SITE.name}</span>
      <Link to="/privacy" className="inline-flex min-h-6 items-center underline-offset-4 hover:text-foreground hover:underline">
        Privacy Policy
      </Link>
      <Link to="/terms" className="inline-flex min-h-6 items-center underline-offset-4 hover:text-foreground hover:underline">
        Terms &amp; Conditions
      </Link>
    </nav>
  )
}
