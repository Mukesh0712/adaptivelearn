import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, Search, UserX } from 'lucide-react'
import { PageMeta } from '@/components/PageMeta'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useListUsersQuery } from '@/features/admin/adminApi'
import { InviteDialog } from '@/features/admin/InviteDialog'
import { RoleBadge, StatusBadge } from '@/features/admin/UserBadges'
import { parseApiError } from '@/features/auth/apiError'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ROLE_LABEL, ROLES, STATUS_LABEL, USER_STATUSES, type Role, type UserStatus } from '@/lib/roles'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10
const ALL = 'all'

const ROLE_ITEMS = [
  { value: ALL, label: 'All roles' },
  ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
]
const STATUS_ITEMS = [
  { value: ALL, label: 'All statuses' },
  ...USER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
]

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })
const formatDate = (iso?: string | null) => (iso ? dateFormat.format(new Date(iso)) : 'Never')

// Values from the URL can be anything a user typed, so only accept known ones.
const asRole = (v: string | null) => (ROLES as readonly string[]).includes(v ?? '') ? (v as Role) : undefined
const asStatus = (v: string | null) =>
  (USER_STATUSES as readonly string[]).includes(v ?? '') ? (v as UserStatus) : undefined

export default function UsersPage() {
  // Filters live in the URL (?q=&role=&status=&page=), so reloading, the
  // back button and shared links all keep the same view.
  const [params, setParams] = useSearchParams()
  const role = asRole(params.get('role'))
  const status = asStatus(params.get('status'))
  const page = Math.max(1, Number(params.get('page')) || 1)
  const urlQuery = params.get('q') ?? ''

  // The search box updates instantly; the request waits until typing pauses.
  const [search, setSearch] = useState(urlQuery)
  const debouncedSearch = useDebouncedValue(search.trim())

  // Changing any filter returns to page 1 (page 4 of the old results may not exist).
  const updateParams = (changes: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    if (debouncedSearch !== urlQuery) updateParams({ q: debouncedSearch || undefined })
    // updateParams is recreated each render; only a new search should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const { data, error, isLoading, isFetching, refetch } = useListUsersQuery({
    q: urlQuery || undefined,
    role,
    status,
    page,
    pageSize: PAGE_SIZE,
  })

  const hasFilters = Boolean(urlQuery || role || status)
  const clearFilters = () => {
    setSearch('')
    updateParams({ q: undefined, role: undefined, status: undefined })
  }

  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0

  return (
    <div className="space-y-6">
      <PageMeta title="Users" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Every account on the platform. Search by name or email.</p>
        </div>
        <InviteDialog />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search users by name or email"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            className="pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            items={ROLE_ITEMS}
            value={role ?? ALL}
            onValueChange={(v) => updateParams({ role: v === ALL ? undefined : (v ?? undefined) })}
          >
            <SelectTrigger aria-label="Filter by role" className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={STATUS_ITEMS}
            value={status ?? ALL}
            onValueChange={(v) => updateParams({ status: v === ALL ? undefined : (v ?? undefined) })}
          >
            <SelectTrigger aria-label="Filter by status" className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          {error ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-destructive">{parseApiError(error).message}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : !isLoading && data?.users.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <UserX className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {hasFilters ? 'No users match these filters.' : 'No users yet.'}
              </p>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table
              // Dim the old page while the next one loads, instead of flashing a spinner.
              className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}
              aria-busy={isFetching}
            >
              <TableCaption className="sr-only">Users, newest first</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="hidden pr-4 md:table-cell">Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-4" colSpan={5}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : data?.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="pl-4">
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                          {/* Phones: role sits under the email instead of its own column. */}
                          <div className="mt-1 sm:hidden">
                            <RoleBadge role={user.role} />
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={user.status ?? 'active'} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="hidden pr-4 md:table-cell">
                          {formatDate(user.lastLoginAt)}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground" aria-live="polite">
            Showing {from}–{to} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              <ChevronLeft aria-hidden="true" />
              Previous
            </Button>
            <span className="hidden text-muted-foreground sm:inline">
              Page {data.page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              Next
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
