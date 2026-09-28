import { useAuth } from '@/app/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROLE_LABEL } from '@/lib/roles'
import { PageMeta } from '@/components/PageMeta'

// Empty dashboard shared by all four portals until real features are built.
export function PortalPlaceholder({ title }: { title: string }) {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <PageMeta title={title} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">
          Welcome, {user?.name}. You are signed in as {user ? ROLE_LABEL[user.role] : ''}.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nothing here yet</CardTitle>
          <CardDescription>Features for this portal will appear here.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  )
}
