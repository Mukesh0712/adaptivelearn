import { History, MailCheck, UserCheck, UserPlus, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { ROLE_LABEL } from '@/lib/roles'
import { useListAuditLogsQuery } from './adminApi'
import type { AuditAction, AuditLog } from './types'

const ICON: Record<AuditAction, LucideIcon> = {
  'user.invited': UserPlus,
  'invite.accepted': UserCheck,
}

// One readable sentence per audit entry. Names come from the snapshot saved
// with the entry when the user has since been removed.
function describe(log: AuditLog): string {
  const actor = log.actor?.name ?? 'Someone'
  const role = log.details.role ? ROLE_LABEL[log.details.role] : 'user'
  switch (log.action) {
    case 'user.invited':
      return `${actor} invited ${log.target?.name ?? log.details.name ?? 'a user'} as ${role}`
    case 'invite.accepted':
      return `${actor} accepted their invite and joined as ${role}`
  }
}

// "5 minutes ago", "yesterday", …
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function RecentActivity() {
  const { data, error, isLoading, refetch } = useListAuditLogsQuery({ limit: 10 })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" aria-hidden="true" />
          Recent activity
        </CardTitle>
        <CardDescription>Invites and account changes, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <p className="text-destructive">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : data?.logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Invites you send will appear here.</p>
        ) : (
          <ul className="grid gap-3">
            {data?.logs.map((log) => {
              const Icon = ICON[log.action] ?? MailCheck
              return (
                <li key={log.id} className="flex items-start gap-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p>{describe(log)}</p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={log.createdAt} title={new Date(log.createdAt).toLocaleString('en-IN')}>
                        {timeAgo(log.createdAt)}
                      </time>
                      {log.action === 'user.invited' && log.details.emailSent === false && ' · email not sent'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
