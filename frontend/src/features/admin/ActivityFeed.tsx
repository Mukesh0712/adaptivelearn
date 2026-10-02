import {
  Archive,
  ArchiveRestore,
  Ban,
  BookPlus,
  BookX,
  ArrowRightLeft,
  CircleCheck,
  CircleX,
  Eraser,
  KeyRound,
  MailCheck,
  MailPlus,
  RotateCcw,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { formatDateTime, timeAgo } from '@/lib/dates'
import { ROLE_LABEL } from '@/lib/roles'
import type { AuditAction, AuditLog } from './types'

const ICON: Record<AuditAction, LucideIcon> = {
  'user.invited': UserPlus,
  'invite.resent': MailPlus,
  'invite.accepted': UserCheck,
  'user.role_changed': UserCog,
  'user.deactivated': Ban,
  'user.reactivated': RotateCcw,
  'user.approved': CircleCheck,
  'user.rejected': CircleX,
  'user.erased': Eraser,
  'course.created': BookPlus,
  'course.archived': Archive,
  'course.restored': ArchiveRestore,
  'course.code_reset': KeyRound,
  'course.student_removed': UserMinus,
  'course.reassigned': ArrowRightLeft,
  'course.deleted': BookX,
}

// One readable sentence per audit entry. Names come from the snapshot saved
// with the entry when the user has since been removed.
function describe(log: AuditLog): string {
  const actor = log.actor?.name ?? 'Someone'
  const d = log.details ?? {}
  const target = log.target?.name ?? d.name ?? 'a user'
  const label = (r?: string) => (r && r in ROLE_LABEL ? ROLE_LABEL[r as keyof typeof ROLE_LABEL] : 'user')
  switch (log.action) {
    case 'user.invited':
      return `${actor} invited ${target} as ${label(d.role)}`
    case 'invite.resent':
      return `${actor} resent the invite to ${target}`
    case 'invite.accepted':
      return `${actor} accepted their invite and joined as ${label(d.role)}`
    case 'user.role_changed':
      return `${actor} changed ${target}'s role from ${label(d.from)} to ${label(d.to)}`
    case 'user.deactivated':
      return d.wasInvited ? `${actor} cancelled the invite for ${target}` : `${actor} deactivated ${target}`
    case 'user.reactivated':
      return `${actor} reactivated ${target}`
    case 'user.approved':
      return `${actor} approved ${target} as ${label(d.role)}`
    case 'user.rejected':
      return `${actor} rejected the sign-up from ${d.name ?? 'someone'} (${label(d.role)})`
    case 'user.erased':
      return `${actor} erased the personal data of a ${label(d.role).toLowerCase()} account`
    case 'course.created':
      return d.instructorName
        ? `${actor} created the course ${d.title ?? ''} for ${d.instructorName}`
        : `${actor} created the course ${d.title ?? ''}`
    case 'course.reassigned':
      return `${actor} moved ${d.title ?? 'a course'} from ${d.from ?? 'someone'} to ${d.to ?? 'someone'}`
    case 'course.deleted':
      return `${actor} deleted the course ${d.title ?? ''}`
    case 'course.archived':
      return `${actor} archived the course ${d.title ?? ''}`
    case 'course.restored':
      return `${actor} restored the course ${d.title ?? ''}`
    case 'course.code_reset':
      return `${actor} created a new join code for ${d.title ?? 'a course'}`
    case 'course.student_removed':
      return `${actor} removed ${log.target?.name ?? 'a student'} from ${d.title ?? 'a course'}`
  }
}


// The list of audit entries with its loading, error and empty states.
// Shared by the dashboard's "Recent activity" card and the Activity page.
//  - showDate: also print the exact date and time (the full history page).
export function ActivityFeed({
  logs,
  error,
  isLoading,
  onRetry,
  skeletonRows = 3,
  showDate = false,
}: {
  logs?: AuditLog[]
  error?: unknown
  isLoading: boolean
  onRetry: () => void
  skeletonRows?: number
  showDate?: boolean
}) {
  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }
  if (!logs?.length) {
    return <p className="text-sm text-muted-foreground">Nothing yet. Invites you send will appear here.</p>
  }

  return (
    <ul className="grid gap-3">
      {logs.map((log) => {
        const Icon = ICON[log.action] ?? MailCheck
        const full = formatDateTime(log.createdAt)
        return (
          <li key={log.id} className="flex items-start gap-3 text-sm">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p>{describe(log)}</p>
              <p className="text-xs text-muted-foreground">
                <time dateTime={log.createdAt} title={full}>
                  {showDate && full ? `${full} · ` : ''}
                  {timeAgo(log.createdAt)}
                </time>
                {log.details?.emailSent === false && ' · email not sent'}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
