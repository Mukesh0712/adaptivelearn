import { Link } from 'react-router'
import { ArrowRight, History } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivityFeed } from './ActivityFeed'
import { useListAuditLogsQuery } from './adminApi'

const SHOWN = 5

// Dashboard card: only the newest few entries, so the card stays short.
// The full, paginated history is on the Activity page.
export function RecentActivity() {
  const { data, error, isLoading, refetch } = useListAuditLogsQuery({ page: 1, pageSize: SHOWN })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" aria-hidden="true" />
          Recent activity
        </CardTitle>
        <CardDescription>Invites and account changes, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        <ActivityFeed logs={data?.logs} error={error} isLoading={isLoading} onRetry={() => void refetch()} />
      </CardContent>
      {!!data?.total && (
        <CardFooter>
          <Link to="/admin/activity" className={buttonVariants({ variant: 'link', className: 'px-0' })}>
            View all activity{data.total > SHOWN ? ` (${data.total})` : ''}
            <ArrowRight aria-hidden="true" />
          </Link>
        </CardFooter>
      )}
    </Card>
  )
}
