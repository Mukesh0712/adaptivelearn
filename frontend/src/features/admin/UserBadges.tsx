import { Badge } from '@/components/ui/badge'
import { ROLE_LABEL, STATUS_LABEL, type Role, type UserStatus } from '@/lib/roles'
import { cn } from '@/lib/utils'

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={role === 'admin' ? 'default' : 'secondary'}>{ROLE_LABEL[role]}</Badge>
}

// The coloured dot is decorative; the word itself carries the meaning, so the
// badge still makes sense to colour-blind users and screen readers.
const DOT: Record<UserStatus, string> = {
  active: 'bg-emerald-600',
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
