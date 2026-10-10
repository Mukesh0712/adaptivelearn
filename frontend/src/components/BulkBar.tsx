import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

// "3 selected  [actions…]  Clear": shown above a list once rows are ticked.
// Shared by Approvals / Join requests and the Users page (invites).
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null
  return (
    <div
      role="region"
      aria-label="Selected items"
      className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background px-4 py-2 shadow-sm"
    >
      <p className="text-sm font-medium">{count} selected</p>
      <div className="flex flex-wrap gap-2">
        {children}
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
