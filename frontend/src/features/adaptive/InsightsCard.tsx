import { Link } from 'react-router'
import { ArrowRight, Radar } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClassInsightsQuery } from './adaptiveApi'

// Course page (instructor/admin): how many students need attention, with a
// link to the full class view.
export function InsightsCard({ courseId, basePath }: { courseId: string; basePath: '/instructor' | '/admin' }) {
  const { data, isLoading, error } = useClassInsightsQuery(courseId)
  const s = data?.summary

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radar className="size-4" aria-hidden="true" />
          Class insights
        </CardTitle>
        <CardDescription>
          {isLoading ? (
            <Skeleton className="h-4 w-56" />
          ) : error || !s ? (
            'Topic mastery and students who may need help.'
          ) : !s.students ? (
            'No students yet.'
          ) : s.atRisk || s.watch ? (
            <>
              <strong className="text-foreground">{s.atRisk} at risk</strong>, {s.watch} to watch, out of {s.students}{' '}
              {s.students === 1 ? 'student' : 'students'}.
            </>
          ) : (
            `No one needs attention right now (${s.students} ${s.students === 1 ? 'student' : 'students'}).`
          )}
        </CardDescription>
        <CardAction>
          <Link to={`${basePath}/courses/${courseId}/insights`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Open
            <span className="sr-only"> class insights</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
    </Card>
  )
}
