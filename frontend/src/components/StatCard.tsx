import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// One number on a dashboard: "Students 42" with an icon and optional hint.
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  loading = false,
}: {
  label: string
  value: number | undefined
  icon: LucideIcon
  hint?: string
  loading?: boolean
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-12" />
          ) : (
            <p className="text-3xl font-semibold tabular-nums">{value ?? 0}</p>
          )}
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  )
}
