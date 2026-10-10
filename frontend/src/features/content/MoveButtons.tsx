import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Up/down arrows. At the ends they're aria-disabled rather than disabled,
// so keyboard focus isn't lost when an item reaches the top or bottom.
export function MoveButtons({
  label,
  index,
  count,
  onMove,
}: {
  label: string
  index: number
  count: number
  onMove: (by: -1 | 1) => void
}) {
  if (count < 2) return null
  const first = index === 0
  const last = index === count - 1
  const cls = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-40'
  return (
    <div className="flex shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        className={cls}
        aria-label={`Move ${label} up`}
        aria-disabled={first}
        onClick={() => !first && onMove(-1)}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cls}
        aria-label={`Move ${label} down`}
        aria-disabled={last}
        onClick={() => !last && onMove(1)}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
    </div>
  )
}
