import { useSearchParams } from 'react-router'
import { PageMeta } from '@/components/PageMeta'
import { Pagination } from '@/components/Pagination'
import { Card, CardContent } from '@/components/ui/card'
import { ActivityFeed } from '@/features/admin/ActivityFeed'
import { useListAuditLogsQuery } from '@/features/admin/adminApi'

const PAGE_SIZE = 20

// Full audit trail: every invite and account change, newest first.
export default function ActivityPage() {
  // The page number lives in the URL, so reload and the back button keep it.
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, error, isLoading, isFetching, refetch } = useListAuditLogsQuery({ page, pageSize: PAGE_SIZE })

  return (
    <div className="space-y-6">
      <PageMeta title="Activity" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">
          Every invite and account change made on the platform, newest first. Entries can't be edited or deleted.
        </p>
      </div>

      <Card>
        <CardContent className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <ActivityFeed
            logs={data?.logs}
            error={error}
            isLoading={isLoading}
            onRetry={() => void refetch()}
            skeletonRows={8}
            showDate
          />
        </CardContent>
      </Card>

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={(next) => {
            setParams(next > 1 ? { page: String(next) } : {})
            window.scrollTo({ top: 0 })
          }}
        />
      )}
    </div>
  )
}
