import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Percent, Users } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { SimpleSelect } from '@/components/SimpleSelect'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { parseApiError } from '@/features/auth/apiError'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useQuizResultsQuery } from './quizApi'
import { QUESTION_TYPE_LABEL, type GradebookRow, type ItemAnalysis, type ItemFlag } from './types'

type Filter = 'all' | 'passed' | 'failed' | 'not_started'

const FLAG_TEXT: Record<ItemFlag, string> = {
  negative_discrimination:
    'Strong students did worse than weak students on this question. Check the answer key and the wording.',
  low_discrimination: "This question doesn't separate strong and weak students well.",
  very_hard: 'Very hard: students got under 30% of the marks. Was it taught, and is it worded clearly?',
  very_easy: 'Very easy: students got over 90% of the marks.',
}

// D → a plain-word rating (common thresholds from classical test theory).
function rateD(d: number | null) {
  if (d === null) return { label: 'Needs at least 4 students', tone: 'text-muted-foreground' }
  if (d < 0) return { label: 'Problem', tone: 'text-red-700 dark:text-red-300' }
  if (d < 0.2) return { label: 'Weak', tone: 'text-amber-700 dark:text-amber-300' }
  if (d < 0.3) return { label: 'Fair', tone: 'text-foreground' }
  return { label: 'Good', tone: 'text-emerald-700 dark:text-emerald-300' }
}

const plain = (text: string) => {
  const t = text.replace(/[`*_#>]/g, '').replace(/\s+/g, ' ').trim()
  return t.length > 160 ? `${t.slice(0, 160)}…` : t
}

// Instructor/admin: one quiz's gradebook and item analysis.
// Route: /{instructor|admin}/courses/:courseId/quizzes/:quizId/results
export default function QuizResultsPage() {
  const { courseId = '', quizId = '' } = useParams()
  const isAdmin = useAuth().user?.role === 'admin'
  const base = `${isAdmin ? '/admin' : '/instructor'}/courses/${courseId}/quizzes/${quizId}`
  const { data, error, isLoading, refetch } = useQuizResultsQuery({ courseId, quizId })
  const [filter, setFilter] = useState<Filter>('all')

  const back = (
    <Link to={base} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      {data?.quiz.title ?? 'Quiz'}
    </Link>
  )
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const { stats, students, items, quiz } = data
  const shown = students.filter((s) =>
    filter === 'all'
      ? true
      : filter === 'passed'
        ? s.passed === true
        : filter === 'failed'
          ? s.passed === false
          : s.bestPercent === null,
  )

  return (
    <div className="space-y-6">
      <PageMeta title={`Results: ${quiz.title}`} />
      <div className="space-y-1">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight break-words">Results: {quiz.title}</h1>
        <p className="text-sm text-muted-foreground">
          {data.course.title} · {quiz.kind === 'graded' ? 'Graded' : 'Practice'} · pass mark {quiz.passPercent}%
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students who took it" value={`${stats.attempted} of ${stats.enrolled}`} icon={Users} hint={stats.inProgress ? `${stats.inProgress} in progress now` : undefined} />
        <StatCard label="Average best score" value={stats.averageBest === null ? '–' : `${stats.averageBest}%`} icon={Percent} hint={stats.averageFirst === null ? undefined : `First attempts: ${stats.averageFirst}%`} />
        <StatCard label="Pass rate" value={stats.passRate === null ? '–' : `${stats.passRate}%`} icon={CheckCircle2} hint="Of students who took it" />
        <StatCard label="Attempts submitted" value={stats.submittedAttempts} icon={BarChart3} />
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>
            <h2>Students</h2>
          </CardTitle>
          <div className="mt-2 grid w-full max-w-56 gap-1.5">
            <Label htmlFor="results-filter" className="text-sm text-muted-foreground">
              Show
            </Label>
            <SimpleSelect
              id="results-filter"
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: `Everyone (${students.length})` },
                { value: 'passed', label: `Passed (${students.filter((s) => s.passed === true).length})` },
                { value: 'failed', label: `Not passed (${students.filter((s) => s.passed === false).length})` },
                { value: 'not_started', label: `Not taken yet (${students.filter((s) => s.bestPercent === null).length})` },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {!shown.length ? (
            <p className="px-4 pb-6 text-sm text-muted-foreground">Nobody in this group.</p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Students and their results for {quiz.title}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Student</TableHead>
                  <TableHead>Best</TableHead>
                  <TableHead className="hidden sm:table-cell">Attempts</TableHead>
                  <TableHead className="hidden md:table-cell">Last submitted</TableHead>
                  <TableHead className="pr-4">
                    <span className="sr-only">Review</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((s) => (
                  <StudentRow key={s.id} s={s} base={base} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="items-heading" className="space-y-3">
        <div>
          <h2 id="items-heading" className="text-lg font-semibold">
            Questions
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.itemBase
              ? `Based on ${data.itemBase} ${data.itemBase === 1 ? "student's" : "students'"} first attempt.`
              : 'Appears once students have submitted.'}
          </p>
        </div>
        <details className="rounded-lg border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">What do these numbers mean?</summary>
          <div className="mt-2 space-y-2 text-muted-foreground">
            <p>
              <strong className="text-foreground">% of marks (difficulty)</strong>: the average share of the points students
              got. Low means hard, high means easy.
            </p>
            <p>
              <strong className="text-foreground">Discrimination (D)</strong>: how much better the top 27% of students (by total
              score) did on the question than the bottom 27%. From 0.3 is good; under 0.2 is weak; below 0 means stronger
              students did worse, which usually points to a wrong answer key or a confusing question.
            </p>
            <p>
              <strong className="text-foreground">Choices</strong>: how often each option was picked. A popular wrong option shows
              a common misunderstanding worth explaining in class.
            </p>
          </div>
        </details>
        {items.length > 0 && (
          <ol className="space-y-3">
            {items.map((item, i) => (
              <li key={item.questionId}>
                <ItemCard item={item} index={i} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function StudentRow({ s, base }: { s: GradebookRow; base: string }) {
  return (
    <TableRow>
      <TableCell className="pl-4 whitespace-normal">
        <div className="flex flex-wrap items-center gap-1.5 font-medium">
          {s.name}
          {!s.enrolled && <Badge variant="outline">Left the course</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">{s.email}</div>
      </TableCell>
      <TableCell>
        {s.bestPercent === null ? (
          <span className="text-sm text-muted-foreground">{s.inProgress ? 'In progress' : 'Not taken'}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="tabular-nums">{s.bestPercent}%</span>
            <Badge variant={s.passed ? 'secondary' : 'outline'}>{s.passed ? 'Passed' : 'Not passed'}</Badge>
          </span>
        )}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {s.attemptIds.length ? (
          <span className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
            {s.attemptIds.map((a) => (
              <Link key={a.id} to={`${base}/attempts/${a.id}`} className="underline-offset-4 hover:underline">
                #{a.number}: {a.percent}%<span className="sr-only">, review {s.name}'s attempt {a.number}</span>
              </Link>
            ))}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell">{s.lastSubmittedAt ? formatDateTime(s.lastSubmittedAt) : '–'}</TableCell>
      <TableCell className="pr-4 text-right">
        {s.latestAttemptId && (
          <Link to={`${base}/attempts/${s.latestAttemptId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Review<span className="sr-only"> {s.name}'s latest attempt</span>
          </Link>
        )}
      </TableCell>
    </TableRow>
  )
}

function Bar({ value, className, label }: { value: number; className?: string; label: string }) {
  // Decorative: the number is always written next to it.
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true" title={label}>
      <div className={cn('h-full rounded-full bg-primary', className)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

function ItemCard({ item, index }: { item: ItemAnalysis; index: number }) {
  const pct = Math.round(item.difficulty * 100)
  const d = rateD(item.discrimination)
  const maxCount = Math.max(1, ...item.choices.map((c) => c.count))
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base leading-snug font-medium break-words">
          {index + 1}. {plain(item.text)}
        </CardTitle>
        <CardDescription className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{QUESTION_TYPE_LABEL[item.type]}</Badge>
          <Badge variant="outline">
            {item.points} {item.points === 1 ? 'pt' : 'pts'}
          </Badge>
          {item.topic && <Badge variant="secondary">{item.topic}</Badge>}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <p className="flex justify-between text-sm">
              <span className="text-muted-foreground">% of marks</span>
              <span className="font-medium tabular-nums">{pct}%</span>
            </p>
            <Bar value={pct} label={`${pct}% of marks`} className={pct < 30 ? 'bg-red-600' : pct > 90 ? 'bg-emerald-600' : undefined} />
            <p className="text-xs text-muted-foreground">
              {item.correct} of {item.responses} fully correct{item.unanswered ? ` · ${item.unanswered} left blank` : ''}
            </p>
          </div>
          <div className="grid content-start gap-1.5">
            <p className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discrimination (D)</span>
              <span className="font-medium tabular-nums">{item.discrimination ?? '–'}</span>
            </p>
            <p className={cn('text-sm font-medium', d.tone)}>{d.label}</p>
          </div>
        </div>

        {item.choices.length > 0 && (
          <div className="grid gap-2">
            <p className="text-sm font-medium">{item.type === 'short' ? 'Most common wrong answers' : 'Choices'}</p>
            <ul className="grid gap-1.5">
              {item.choices.map((c, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
                  <span className="break-words">
                    {c.label}
                    {c.correct && <span className="ml-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">(correct)</span>}
                  </span>
                  <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                    <Bar value={(c.count / maxCount) * 100} label={`${c.count} students`} className={c.correct ? 'bg-emerald-600' : 'bg-slate-400'} />
                  </span>
                  <span className="text-right tabular-nums">
                    {c.count}
                    <span className="text-muted-foreground"> ({item.responses ? Math.round((c.count / item.responses) * 100) : 0}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {item.type === 'short' && !item.choices.length && item.responses > 0 && (
          <p className="text-sm text-muted-foreground">No wrong answers to show.</p>
        )}

        {item.flags.map((f) => (
          <p key={f} className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {FLAG_TEXT[f]}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
