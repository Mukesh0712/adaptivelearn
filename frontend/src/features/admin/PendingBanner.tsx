import { Link } from 'react-router'
import { UserRoundCheck } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { buttonVariants } from '@/components/ui/button'
import { useListApprovalsQuery, useListJoinRequestsQuery } from '@/features/approvals/approvalsApi'

// "3 sign-ups are waiting for your approval  [Review]" for an admin, or
// "2 students asked to join your courses  [Review]" for an instructor.
// Counts both account sign-ups and course join requests. Hidden when
// nobody is waiting. Asks only for the counts (page size 1).
export function PendingBanner({ hidden = false }: { hidden?: boolean }) {
  const isAdmin = useAuth().user?.role === 'admin'
  const signups = useListApprovalsQuery({ page: 1, pageSize: 1 }).data?.total ?? 0
  const joins = useListJoinRequestsQuery({ page: 1, pageSize: 1 }).data?.total ?? 0
  const count = signups + joins
  if (hidden || count === 0) return null

  const text = isAdmin
    ? [
        signups ? `${signups} ${signups === 1 ? 'sign-up' : 'sign-ups'}` : '',
        joins ? `${joins} course join ${joins === 1 ? 'request' : 'requests'}` : '',
      ]
        .filter(Boolean)
        .join(' and ') + ` ${count === 1 ? 'is' : 'are'} waiting for your approval`
    : `${count === 1 ? '1 student has' : `${count} students have`} asked to join your courses`
  // Only join requests waiting: open that tab directly.
  const view = signups === 0 ? '?view=courses' : ''

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"
    >
      <p className="flex items-center gap-2">
        <UserRoundCheck className="size-4 shrink-0" aria-hidden="true" />
        {text}
      </p>
      <Link to={`${isAdmin ? '/admin/approvals' : '/instructor/requests'}${view}`} className={buttonVariants({ size: 'sm' })}>
        Review
      </Link>
    </div>
  )
}
