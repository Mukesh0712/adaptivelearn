import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ClipboardList, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { SimpleSelect } from '@/components/SimpleSelect'
import { SubmitButton } from '@/components/SubmitButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { FieldError } from '@/features/auth/pages/AuthCard'
import { parseApiError } from '@/features/auth/apiError'
import { useCourseContentQuery } from '@/features/content/contentApi'
import { LessonStatusBadge } from '@/features/content/LessonStatusBadge'
import { formatDateTime } from '@/lib/dates'
import { useCourseQuizzesQuery, useCreateQuizMutation } from './quizApi'
import type { QuizKind } from './types'

const COURSE_TEST = '__course__'

// Course page (instructor/admin): every quiz of the course, module quizzes
// and standalone course tests together.
export function QuizzesCard({ courseId, basePath }: { courseId: string; basePath: '/instructor' | '/admin' }) {
  const { data, error, isLoading, refetch } = useCourseQuizzesQuery(courseId)
  const [creating, setCreating] = useState(false)
  const quizzes = data?.quizzes ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-4" aria-hidden="true" />
          Quizzes
        </CardTitle>
        <CardDescription>
          Practice quizzes inside a module, or graded course tests. Answers are checked automatically.
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New quiz
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <p className="text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !quizzes.length ? (
          <p className="text-sm text-muted-foreground">No quizzes yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {quizzes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`${basePath}/courses/${courseId}/quizzes/${q.id}`}
                    className="font-medium break-words hover:underline"
                  >
                    {q.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {q.moduleTitle ?? 'Course test'} · {q.questionCount} {q.questionCount === 1 ? 'question' : 'questions'} ·{' '}
                    {q.totalPoints} {q.totalPoints === 1 ? 'point' : 'points'}
                    {q.timeLimitMinutes ? ` · ${q.timeLimitMinutes} min` : ''}
                    {q.dueAt ? ` · due ${formatDateTime(q.dueAt)}` : ''}
                  </p>
                </div>
                {!!q.studentsTaken && (
                  <Link
                    to={`${basePath}/courses/${courseId}/quizzes/${q.id}/results`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {q.studentsTaken} {q.studentsTaken === 1 ? 'student' : 'students'} took it
                    <span className="sr-only">: results of {q.title}</span>
                  </Link>
                )}
                <Badge variant="secondary">{q.kind === 'graded' ? 'Graded' : 'Practice'}</Badge>
                <LessonStatusBadge status={q.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          {creating && <NewQuizForm courseId={courseId} basePath={basePath} onDone={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function NewQuizForm({ courseId, basePath, onDone }: { courseId: string; basePath: string; onDone: () => void }) {
  const navigate = useNavigate()
  const { data: content } = useCourseContentQuery(courseId)
  const [title, setTitle] = useState('')
  const [placement, setPlacement] = useState(COURSE_TEST)
  const [kind, setKind] = useState<QuizKind>('practice')
  const [error, setError] = useState('')
  const [createQuiz, { isLoading }] = useCreateQuizMutation()

  const places = [
    { value: COURSE_TEST, label: 'Course test (not in a module)' },
    ...(content?.modules ?? []).map((m) => ({ value: m.id, label: `Module: ${m.title}` })),
  ]

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 2) {
      setError('Title must be at least 2 characters')
      return
    }
    try {
      const res = await createQuiz({
        courseId,
        title: title.trim(),
        module: placement === COURSE_TEST ? null : placement,
        kind,
      }).unwrap()
      toast.success(res.message)
      onDone()
      void navigate(`${basePath}/courses/${courseId}/quizzes/${res.quiz.id}`)
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>New quiz</DialogTitle>
        <DialogDescription>It starts as a draft. You add the questions next, then publish it.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="quiz-title">Title</Label>
        <Input
          id="quiz-title"
          autoFocus
          maxLength={150}
          value={title}
          placeholder="e.g. Week 1 Quiz, Mid-term"
          aria-invalid={!!error}
          aria-describedby={error ? 'quiz-title-error' : undefined}
          onChange={(e) => {
            setTitle(e.target.value)
            setError('')
          }}
        />
        <FieldError id="quiz-title-error" message={error} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quiz-placement">Where</Label>
        <SimpleSelect id="quiz-placement" value={placement} onChange={setPlacement} items={places} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="quiz-kind">Type</Label>
        <SimpleSelect
          id="quiz-kind"
          value={kind}
          onChange={setKind}
          items={[
            { value: 'practice', label: 'Practice: for learning, answers shown after submitting' },
            { value: 'graded', label: 'Graded: a test, answers hidden until it closes' },
          ]}
        />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton loading={isLoading} loadingText="Creating…" className="sm:w-auto">
          Create and add questions
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
