import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CircleCheck, UserRoundCheck, XCircle } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { BulkBar } from '@/components/BulkBar'
import { PageMeta } from '@/components/PageMeta'
import { Pagination } from '@/components/Pagination'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RoleBadge } from '@/features/admin/UserBadges'
import { parseApiError } from '@/features/auth/apiError'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { cn } from '@/lib/utils'
import {
  useApproveJoinRequestsMutation,
  useApproveRequestsMutation,
  useListApprovalsQuery,
  useListJoinRequestsQuery,
  useRejectJoinRequestsMutation,
  useRejectRequestsMutation,
} from './approvalsApi'
import { showApprovalResult } from './showResult'
import { toast } from 'sonner'

const PAGE_SIZE = 20

type View = 'signups' | 'courses'

// Shared by the admin ("Approvals": everyone) and the instructor ("Join
// requests": their own courses). Two tabs:
//  - Account sign-ups: new accounts waiting to be activated;
//  - Course join requests: existing students who entered a course code.
// The tab is in the URL (?view=courses), so links can open it directly.
export default function ApprovalsPage() {
  const isAdmin = useAuth().user?.role === 'admin'
  const [params] = useSearchParams()
  const view: View = params.get('view') === 'courses' ? 'courses' : 'signups'
  // Page size 1: only the totals, for the tab labels.
  const signups = useListApprovalsQuery({ page: 1, pageSize: 1 })
  const joins = useListJoinRequestsQuery({ page: 1, pageSize: 1 })
  const title = isAdmin ? 'Approvals' : 'Join requests'
  const tabs: { view: View; label: string; count?: number }[] = [
    { view: 'signups', label: 'Account sign-ups', count: signups.data?.total },
    { view: 'courses', label: 'Course join requests', count: joins.data?.total },
  ]

  return (
    <div className="space-y-6">
      <PageMeta title={title} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">
          {view === 'courses'
            ? isAdmin
              ? 'Students who already have an account and entered the code of a course that needs approval.'
              : 'Students who already have an account and entered the code of one of your courses. Approving adds them to the course.'
            : isAdmin
              ? 'Everyone who signed up and is waiting for approval. Instructors can also approve students for their own courses.'
              : 'Students who signed up with one of your class codes. Approving them activates their account and adds them to the class.'}
        </p>
      </div>

      {/* Tabs are links (each view has its own address); aria-current marks the open one. */}
      <nav aria-label="Request type" className="flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.view}
            to={{ search: t.view === 'signups' ? '' : '?view=courses' }}
            aria-current={view === t.view ? 'page' : undefined}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              view === t.view ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {!!t.count && (
              <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{t.count}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* key: switching tabs starts a fresh list (page 1, nothing ticked). */}
      <RequestQueue key={view} view={view} isAdmin={isAdmin} title={title} />
    </div>
  )
}

function RequestQueue({ view, isAdmin, title }: { view: View; isAdmin: boolean; title: string }) {
  const forCourses = view === 'courses'
  const [page, setPage] = useState(1)
  const signups = useListApprovalsQuery({ page, pageSize: PAGE_SIZE }, { skip: forCourses })
  const joins = useListJoinRequestsQuery({ page, pageSize: PAGE_SIZE }, { skip: !forCourses })
  const { data, error, isLoading, isFetching, refetch } = forCourses ? joins : signups
  const [approveSignups, approvingSignups] = useApproveRequestsMutation()
  const [rejectSignups, rejectingSignups] = useRejectRequestsMutation()
  const [approveJoins, approvingJoins] = useApproveJoinRequestsMutation()
  const [rejectJoins, rejectingJoins] = useRejectJoinRequestsMutation()
  const approve = forCourses ? approveJoins : approveSignups
  const reject = forCourses ? rejectJoins : rejectSignups
  const approving = forCourses ? approvingJoins : approvingSignups
  const rejecting = forCourses ? rejectingJoins : rejectingSignups
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmReject, setConfirmReject] = useState<string[] | null>(null)
  const busy = approving.isLoading || rejecting.isLoading

  const rows = data?.requests ?? []
  // Selection only covers what's on screen: drop ids no longer listed.
  const visible = new Set(rows.map((r) => r.id))
  const chosen = [...selected].filter((id) => visible.has(id))
  const allChecked = rows.length > 0 && chosen.length === rows.length

  const selectAll = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = chosen.length > 0 && !allChecked
  }, [chosen.length, allChecked])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = async (action: 'approve' | 'reject', ids: string[]) => {
    try {
      const result = await (action === 'approve' ? approve(ids) : reject(ids)).unwrap()
      showApprovalResult(result)
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))))
      setConfirmReject(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Bulk bar: appears once something is ticked. */}
      <BulkBar count={chosen.length} onClear={() => setSelected(new Set())}>
        <Button size="sm" disabled={busy} onClick={() => void run('approve', chosen)}>
          <CircleCheck aria-hidden="true" />
          Approve selected
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmReject(chosen)}>
          <XCircle aria-hidden="true" />
          Reject selected
        </Button>
      </BulkBar>

      <Card className="py-0">
        <CardContent className="px-0">
          {error ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : !isLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <UserRoundCheck className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">All caught up</p>
              <p className="text-sm text-muted-foreground">New requests will appear here.</p>
            </div>
          ) : (
            <Table className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <TableCaption className="sr-only">
                {title}: {forCourses ? 'course join requests' : 'account sign-ups'}, oldest first
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-px pl-4">
                    <input
                      ref={selectAll}
                      type="checkbox"
                      aria-label="Select all on this page"
                      className="size-4 accent-primary"
                      checked={allChecked}
                      disabled={isLoading || rows.length === 0}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {forCourses ? 'Course' : isAdmin ? 'Role / class' : 'Class'}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">{forCourses ? 'Asked' : 'Signed up'}</TableHead>
                  <TableHead className="w-px pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 4 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-4" colSpan={5}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : rows.map((r) => (
                      <TableRow key={r.id} data-state={selected.has(r.id) ? 'selected' : undefined}>
                        <TableCell className="pl-4">
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.name}`}
                            className="size-4 accent-primary"
                            checked={selected.has(r.id)}
                            onChange={() => toggle(r.id)}
                          />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                          {/* Phones: class under the name. */}
                          {r.course && <div className="text-xs sm:hidden">{r.course.title}</div>}
                        </TableCell>
                        <TableCell className="hidden whitespace-normal sm:table-cell">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isAdmin && !forCourses && <RoleBadge role={r.role} />}
                            {r.course ? (
                              <span>{r.course.title}</span>
                            ) : (
                              !isAdmin && <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)}>
                            {timeAgo(r.createdAt)}
                          </time>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              aria-label={`Approve ${r.name}`}
                              onClick={() => void run('approve', [r.id])}
                            >
                              <CircleCheck aria-hidden="true" />
                              <span className="hidden lg:inline">Approve</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              aria-label={`Reject ${r.name}`}
                              onClick={() => setConfirmReject([r.id])}
                            >
                              <XCircle aria-hidden="true" />
                              <span className="hidden lg:inline">Reject</span>
                            </Button>
                          </div>
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
          onPageChange={(next) => {
            setPage(next)
            setSelected(new Set())
          }}
        />
      )}

      <AlertDialog open={!!confirmReject} onOpenChange={(open) => !open && setConfirmReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmReject?.length === 1
                ? `Reject ${rows.find((r) => r.id === confirmReject[0])?.name ?? 'this sign-up'}?`
                : `Reject ${confirmReject?.length ?? 0} ${forCourses ? 'requests' : 'sign-ups'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {forCourses
                ? "They won't be added to the course. They could ask again with the same code; create a new code if you don't want that."
                : "Their pending accounts are removed and they can't log in. If it was a mistake, they can register again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <SubmitButton
              type="button"
              variant="destructive"
              className="sm:w-auto"
              loading={rejecting.isLoading}
              loadingText="Rejecting…"
              onClick={() => confirmReject && void run('reject', confirmReject)}
            >
              Reject
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
