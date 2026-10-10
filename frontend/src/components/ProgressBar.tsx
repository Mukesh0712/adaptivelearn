import { cn } from '@/lib/utils'

// "3 of 7 lessons done" with a bar. role="progressbar" + aria-value* let
// screen readers announce it ("43 percent").
export function ProgressBar({
  done,
  total,
  label,
  className,
}: {
  done: number
  total: number
  label: string // what the bar measures, e.g. "Progress in Data Structures"
  className?: string
}) {
  const percent = total ? Math.round((done / total) * 100) : 0
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {total ? `${done} of ${total} ${total === 1 ? 'lesson' : 'lessons'} done` : 'No lessons published yet'}
        </span>
        {total > 0 && <span className="font-medium tabular-nums">{percent}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={total ? `${percent}%, ${done} of ${total} lessons done` : 'No lessons published yet'}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', percent === 100 ? 'bg-emerald-600' : 'bg-primary')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
