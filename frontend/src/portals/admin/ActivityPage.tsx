import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { PageMeta } from '@/components/PageMeta'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ActivityFeed } from '@/features/admin/ActivityFeed'
import { useListAuditActorsQuery, useListAuditLogsQuery } from '@/features/admin/adminApi'
import type { AuditCategory } from '@/features/admin/types'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

const PAGE_SIZE = 20
const ALL = 'all'
const CATEGORY_ITEMS: { value: AuditCategory | typeof ALL; label: string }[] = [
  { value: ALL, label: 'All categories' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'invites', label: 'Invites' },
  { value: 'accounts', label: 'Account changes' },
  { value: 'courses', label: 'Courses' },
]
const isCategory = (v: string | null): v is AuditCategory =>
  v === 'approvals' || v === 'invites' || v === 'accounts' || v === 'courses'
const isDay = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

// "2026-10-10" in the admin's own time zone → the exact start / end of that day.
const startOfDay = (day: string) => new Date(`${day}T00:00:00`).toISOString()
const endOfDay = (day: string) => new Date(`${day}T23:59:59.999`).toISOString()

// Full audit trail, newest first, with filters. Filters and page live in
// the URL, so reload, back and shared links keep the same view.
export default function ActivityPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const category = isCategory(params.get('category')) ? (params.get('category') as AuditCategory) : undefined
  const actor = /^[a-f0-9]{24}$/.test(params.get('actor') ?? '') ? params.get('actor')! : undefined
  const from = isDay(params.get('from')) ? params.get('from')! : ''
  const to = isDay(params.get('to')) ? params.get('to')! : ''
  const urlQuery = params.get('q') ?? ''

  const [search, setSearch] = useState(urlQuery)
  const debouncedSearch = useDebouncedValue(search.trim())

  // Changing a filter goes back to page 1.
  const update = (changes: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )

  useEffect(() => {
    if (debouncedSearch !== urlQuery) update({ q: debouncedSearch || undefined })
    // update is recreated each render; only a new search should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const { data, error, isLoading, isFetching, refetch } = useListAuditLogsQuery({
    page,
    pageSize: PAGE_SIZE,
    ...(category ? { category } : {}),
    ...(actor ? { actor } : {}),
    ...(from ? { from: startOfDay(from) } : {}),
    ...(to ? { to: endOfDay(to) } : {}),
    ...(urlQuery ? { q: urlQuery } : {}),
  })
  const { data: actorData } = useListAuditActorsQuery()
  const actorItems = [
    { value: ALL, label: 'Anyone' },
    ...(actorData?.actors ?? []).map((a) => ({ value: a.id, label: a.name })),
  ]

  const hasFilters = Boolean(category || actor || from || to || urlQuery)
  const clear = () => {
    setSearch('')
    setParams({}, { replace: true })
  }
  const years = data?.retentionDays ? Math.round(data.retentionDays / 365) : 0

  return (
    <div className="space-y-6">
      <PageMeta title="Activity" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">
          Every invite, approval, account and course change, newest first. Entries can't be edited or deleted
          {data?.retentionDays &&
            `; they're removed automatically after ${
              years >= 1 && data.retentionDays % 365 === 0 ? `${years} year${years > 1 ? 's' : ''}` : `${data.retentionDays} days`
            }`}
          .
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto_auto] lg:items-end">
        <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="activity-search">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="activity-search"
              type="search"
              placeholder="Names or course titles"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-category">Category</Label>
          <Select
            items={CATEGORY_ITEMS}
            value={category ?? ALL}
            onValueChange={(v) => update({ category: v === ALL ? undefined : ((v as string | null) ?? undefined) })}
          >
            <SelectTrigger id="activity-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-actor">Who did it</Label>
          <Select
            items={actorItems}
            value={actor ?? ALL}
            onValueChange={(v) => update({ actor: v === ALL ? undefined : ((v as string | null) ?? undefined) })}
          >
            <SelectTrigger id="activity-actor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actorItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-from">From</Label>
          <Input
            id="activity-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => update({ from: e.target.value || undefined })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="activity-to">To</Label>
          <Input
            id="activity-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => update({ to: e.target.value || undefined })}
          />
        </div>
        <Button variant="outline" disabled={!hasFilters} onClick={clear}>
          Clear filters
        </Button>
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
            emptyText={hasFilters ? 'No activity matches these filters.' : 'Nothing yet.'}
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
            update({ page: next > 1 ? String(next) : undefined })
            window.scrollTo({ top: 0 })
          }}
        />
      )}
    </div>
  )
}
