import { Link, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, BookOpen, Eye, UsersRound } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { timeAgo } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useClassInsightsQuery } from './adaptiveApi'
import { LEVEL_LABEL, type ClassInsights, type InsightStudent, type MasteryLevel } from './types'

const CELL: Record<MasteryLevel, string> = {
  mastered: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
  learning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  needs_practice: 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100',
}

// Instructor/admin: the whole class. Students who need attention (with the
// reasons), then a heatmap of every student's mastery per topic.
// Route: /{instructor|admin}/courses/:courseId/insights
export default function ClassInsightsPage() {
  const { courseId = '' } = useParams()
  const isAdmin = useAuth().user?.role === 'admin'
  const coursePath = `${isAdmin ? '/admin' : '/instructor'}/courses/${courseId}`
  const { data, error, isLoading, refetch } = useClassInsightsQuery(courseId)

  const back = (
    <Link to={coursePath} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      Course
    </Link>
  )

  return (
    <div className="space-y-6">
      <PageMeta title="Class insights" />
      <div className="space-y-1">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight">Class insights</h1>
        <p className="text-sm text-muted-foreground">
          Calculated from quiz answers and lesson progress. Updated every time you open this page.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : isLoading || !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </>
      ) : (
        <Insights data={data} />
      )}
    </div>
  )
}

function Insights({ data }: { data: ClassInsights }) {
  const { summary } = data
  const flagged = data.students.filter((s) => s.risk.level !== 'ok')
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={summary.students} icon={UsersRound} />
        <StatCard label="At risk" value={summary.atRisk} icon={AlertTriangle} hint="Two or more warning signs" />
        <StatCard label="To watch" value={summary.watch} icon={Eye} hint="One warning sign" />
        <StatCard label="Published lessons" value={summary.lessons} icon={BookOpen} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Students who need attention</h2>
          </CardTitle>
          <CardDescription>
            Flagged for low quiz scores, weak topics, falling behind on lessons, 14+ days without activity, or missed
            graded quizzes. Only you and admins see this.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!flagged.length ? (
            <p className="text-sm text-muted-foreground">
              {summary.students ? 'No one needs attention right now.' : 'No students in this course yet.'}
            </p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {flagged.map((s) => (
                <li key={s.id}>
                  <FlaggedStudent s={s} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Topic mastery</h2>
          </CardTitle>
          <CardDescription>
            Each cell is a student's estimated mastery of a topic (Bayesian Knowledge Tracing). The topic the class
            finds hardest comes first. A dash means the student hasn't answered questions on it yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data.topics.length ? (
            <p className="text-sm text-muted-foreground">No quiz answers yet. The heatmap fills in as students take quizzes.</p>
          ) : (
            <>
              <Heatmap data={data} />
              <Legend />
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function FlaggedStudent({ s }: { s: InsightStudent }) {
  const atRisk = s.risk.level === 'at_risk'
  return (
    <div className="h-full rounded-lg border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium break-words">{s.name}</span>
        <Badge
          className={
            atRisk
              ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
          }
        >
          {atRisk ? 'At risk' : 'Watch'}
        </Badge>
      </div>
      <p className="text-xs break-all text-muted-foreground">{s.email}</p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        {s.risk.reasons.map((r) => (
          <li key={r.signal}>{r.text}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {s.lessonsDone} lessons done · {s.quizzesTaken} {s.quizzesTaken === 1 ? 'quiz' : 'quizzes'} taken
        {s.averageScore !== null ? ` · average ${s.averageScore}%` : ''} · last active {timeAgo(s.lastActivity)}
      </p>
    </div>
  )
}

// Students down, topics across. Colour AND the number in each cell, so it
// works without colour vision; screen readers get the level too.
function Heatmap({ data }: { data: ClassInsights }) {
  return (
    // A keyboard-focusable scroll area: wide tables scroll sideways inside
    // it instead of stretching the page. `relative` keeps the cells'
    // screen-reader-only text (position: absolute) inside it too.
    <div className="relative overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Topic mastery table (scrolls sideways)">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Mastery per student and topic, in percent</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">
              Student
            </th>
            {data.topics.map((t) => (
              <th key={t.key} scope="col" className="min-w-24 px-2 py-2 text-center font-medium">
                <span className="block break-words">{t.topic}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  class avg {Math.round(t.average * 100)}%
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.id} className="border-b last:border-0">
              <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-normal whitespace-nowrap">
                {s.name}
              </th>
              {data.topics.map((t) => {
                const cell = s.topics[t.key]
                return (
                  <td key={t.key} className="p-1 text-center">
                    {cell ? (
                      <span
                        className={cn('block rounded px-2 py-1 font-medium tabular-nums', CELL[cell.level])}
                        title={`${LEVEL_LABEL[cell.level]} · ${cell.answered} answered`}
                      >
                        {Math.round(cell.mastery * 100)}%<span className="sr-only">, {LEVEL_LABEL[cell.level]}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        –<span className="sr-only">not answered yet</span>
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Colour key">
      {(['mastered', 'learning', 'needs_practice'] as const).map((l) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className={cn('inline-block size-3 rounded-sm', CELL[l])} aria-hidden="true" />
          {LEVEL_LABEL[l]} {l === 'mastered' ? '(95%+)' : l === 'needs_practice' ? '(under 40%)' : '(40–94%)'}
        </li>
      ))}
    </ul>
  )
}
