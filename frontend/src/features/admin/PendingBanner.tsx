import { Link } from 'react-router'
import { UserRoundCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useListUsersQuery } from './adminApi'

// "3 sign-ups are waiting for your approval  [Review]". Shown on the admin
// dashboard and the Users page; hidden when nobody is waiting. Asks only for
// the count (page size 1), not the whole list.
export function PendingBanner({ hidden = false }: { hidden?: boolean }) {
  const { data } = useListUsersQuery({ status: 'pending', page: 1, pageSize: 1 })
  const count = data?.total ?? 0
  if (hidden || count === 0) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100"
    >
      <p className="flex items-center gap-2">
        <UserRoundCheck className="size-4 shrink-0" aria-hidden="true" />
        {count === 1 ? '1 sign-up is' : `${count} sign-ups are`} waiting for your approval
      </p>
      <Link to="/admin/users?status=pending" className={buttonVariants({ size: 'sm' })}>
        Review
      </Link>
    </div>
  )
}
