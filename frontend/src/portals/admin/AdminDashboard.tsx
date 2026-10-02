import { Link } from 'react-router'
import { ArrowRight, UsersRound } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RecentActivity } from '@/features/admin/RecentActivity'

export default function AdminDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <PageMeta title="Admin dashboard" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.name}.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-4" aria-hidden="true" />
              Users
            </CardTitle>
            <CardDescription>See every account and invite instructors.</CardDescription>
            <Button variant="outline" className="mt-2 w-fit" nativeButton={false} render={<Link to="/admin/users" />}>
              Manage users
              <ArrowRight aria-hidden="true" />
            </Button>
          </CardHeader>
        </Card>
        <RecentActivity />
      </div>
    </div>
  )
}
