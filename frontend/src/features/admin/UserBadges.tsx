import { Badge } from '@/components/ui/badge'
import { ROLE_LABEL, STATUS_LABEL, type Role, type UserStatus } from '@/lib/roles'
import { cn } from '@/lib/utils'

// Each role has its own colour so a long list is quick to scan. The role name
// is always written on the badge, so colour is never the only signal.
const ROLE_COLOR: Record<Role, string> = {
  admin: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
  instructor: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
  student: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  parent: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge className={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Badge>
}

// The coloured dot is decorative; the word itself carries the meaning, so the
// badge still makes sense to colour-blind users and screen readers.
const DOT: Record<UserStatus, string> = {
  active: 'bg-emerald-600',
  pending: 'bg-sky-600',
  invited: 'bg-amber-500',
  deactivated: 'bg-destructive',
}

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge variant="outline" className={cn(status === 'deactivated' && 'text-destructive')}>
      <span className={cn('size-1.5 rounded-full', DOT[status])} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </Badge>
  )
}
