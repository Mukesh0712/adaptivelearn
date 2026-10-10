import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router'
import { MailPlus, Search, UserX, XCircle } from 'lucide-react'
import { BulkBar } from '@/components/BulkBar'
import { SubmitButton } from '@/components/SubmitButton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageMeta } from '@/components/PageMeta'
import { Pagination } from '@/components/Pagination'
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
import {
  useBulkCancelInvitesMutation,
  useBulkResendInvitesMutation,
  useListUsersQuery,
} from '@/features/admin/adminApi'
import { showApprovalResult } from '@/features/approvals/showResult'
import { InviteDialog } from '@/features/admin/InviteDialog'
import { PendingBanner } from '@/features/admin/PendingBanner'
import { UserActions } from '@/features/admin/UserActions'
import { useAuth } from '@/app/hooks'
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
// Formatting an invalid date throws, so check it first.
const formatDate = (iso?: string | null) => {
  const date = iso ? new Date(iso) : null
  return date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : 'Never'
}

// Values from the URL can be anything a user typed, so only accept known ones.
const asRole = (v: string | null) => (ROLES as readonly string[]).includes(v ?? '') ? (v as Role) : undefined
const asStatus = (v: string | null) =>
  (USER_STATUSES as readonly string[]).includes(v ?? '') ? (v as UserStatus) : undefined

export default function UsersPage() {
  const { user: me } = useAuth()
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

  // Bulk mode: when looking at Invited users, rows get checkboxes so several
  // invites can be resent or cancelled at once.
  const bulkMode = status === 'invited'
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [bulkResend, resending] = useBulkResendInvitesMutation()
  const [bulkCancel, cancelling] = useBulkCancelInvitesMutation()
  const selectable = bulkMode ? (data?.users ?? []).filter((u) => u.status === 'invited') : []
  const chosen = selectable.filter((u) => selected.has(u.id)).map((u) => u.id)
  const allChecked = selectable.length > 0 && chosen.length === selectable.length
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const runBulk = async (action: 'resend' | 'cancel') => {
    try {
      showApprovalResult(await (action === 'resend' ? bulkResend(chosen) : bulkCancel(chosen)).unwrap())
      setSelected(new Set())
      setConfirmCancel(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const hasFilters = Boolean(urlQuery || role || status)
  const clearFilters = () => {
    setSearch('')
    updateParams({ q: undefined, role: undefined, status: undefined })
  }

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

      {/* Hidden while already looking at the pending list. */}
      <PendingBanner hidden={status === 'pending'} />

      {bulkMode && (
        <BulkBar count={chosen.length} onClear={() => setSelected(new Set())}>
          <Button size="sm" disabled={resending.isLoading} onClick={() => void runBulk('resend')}>
            <MailPlus aria-hidden="true" />
            {resending.isLoading ? 'Resending…' : 'Resend selected'}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmCancel(true)}>
            <XCircle aria-hidden="true" />
            Cancel selected
          </Button>
        </BulkBar>
      )}

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
                  {bulkMode && (
                    <TableHead className="w-px pl-4">
                      <input
                        type="checkbox"
                        aria-label="Select all invites on this page"
                        className="size-4 accent-primary"
                        checked={allChecked}
                        disabled={selectable.length === 0}
                        onChange={() => setSelected(allChecked ? new Set() : new Set(selectable.map((u) => u.id)))}
                      />
                    </TableHead>
                  )}
                  <TableHead className={bulkMode ? '' : 'pl-4'}>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="hidden md:table-cell">Last login</TableHead>
                  <TableHead className="w-px pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-4" colSpan={bulkMode ? 7 : 6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : data?.users.map((user) => (
                      <TableRow key={user.id} data-state={selected.has(user.id) ? 'selected' : undefined}>
                        {bulkMode && (
                          <TableCell className="pl-4">
                            {user.status === 'invited' && (
                              <input
                                type="checkbox"
                                aria-label={`Select ${user.name}`}
                                className="size-4 accent-primary"
                                checked={selected.has(user.id)}
                                onChange={() => toggle(user.id)}
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell className={bulkMode ? '' : 'pl-4'}>
                          <div className="font-medium">
                            {user.name}
                            {user.id === me?.id && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                            )}
                            {user.erasedAt && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(data erased)</span>
                            )}
                          </div>
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
                        <TableCell className="hidden md:table-cell">{formatDate(user.lastLoginAt)}</TableCell>
                        <TableCell className="pr-4 text-right">
                          {/* Admin accounts (including your own) can't be changed here. */}
                          {/* Admins (including yourself) and erased accounts can't be changed. */}
                          {user.role !== 'admin' && user.id !== me?.id && !user.erasedAt && <UserActions user={user} />}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={(next) => updateParams({ page: String(next) })}
        />
      )}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {chosen.length} {chosen.length === 1 ? 'invite' : 'invites'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their invite links stop working. You can reactivate them later and send new invites.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <SubmitButton
              type="button"
              variant="destructive"
              className="sm:w-auto"
              loading={cancelling.isLoading}
              loadingText="Cancelling…"
              onClick={() => void runBulk('cancel')}
            >
              Cancel invites
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
