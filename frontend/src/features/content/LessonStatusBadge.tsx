import { Badge } from '@/components/ui/badge'
import type { LessonStatus } from './types'

// "Draft" (only the instructor sees it) or "Published" (students see it).
export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  return status === 'published' ? (
    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">Published</Badge>
  ) : (
    <Badge variant="outline">Draft</Badge>
  )
}
