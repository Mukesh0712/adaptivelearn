import { useAuth } from '@/app/hooks'
import { ROLE_LABEL } from '@/lib/roles'

// Empty dashboard shared by all four portals until real features are built.
export function PortalPlaceholder({ title }: { title: string }) {
  const { user } = useAuth()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        Welcome, {user?.name}. You are signed in as {user ? ROLE_LABEL[user.role] : ''}.
      </p>
      <p className="text-sm text-muted-foreground">Features for this portal will appear here.</p>
    </div>
  )
}
