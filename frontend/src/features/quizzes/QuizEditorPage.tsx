import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, BarChart3, EyeOff, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { SimpleSelect } from '@/components/SimpleSelect'
import { SubmitButton } from '@/components/SubmitButton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { FieldError } from '@/features/auth/pages/AuthCard'
import { parseApiError } from '@/features/auth/apiError'
import { LessonStatusBadge } from '@/features/content/LessonStatusBadge'
import { MoveButtons } from '@/features/content/MoveButtons'
import { moved } from '@/features/content/utils'
import { QuestionDialog } from './QuestionDialog'
import {
  useDeleteQuestionMutation,
  useDeleteQuizMutation,
  useQuizForEditingQuery,
  useReorderQuestionsMutation,
  useUpdateQuizMutation,
} from './quizApi'
import {
  MAX_QUESTIONS,
  QUESTION_TYPE_LABEL,
  REVEAL_LABEL,
  type Question,
  type Quiz,
  type QuizEditorData,
  type QuizKind,
  type RevealMode,
} from './types'

const COURSE_TEST = '__course__'

// ISO date ↔ the value of <input type="datetime-local"> (local time, no zone).
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

// What "Automatic" means for these settings (same rules as the server's).
function autoRevealText(kind: QuizKind, hasDue: boolean, maxAttempts: number | null) {
  if (kind === 'practice') return 'Practice quiz: answers are shown right after submitting.'
  if (hasDue) return 'Graded with a due date: answers are shown after the due date.'
  if (maxAttempts) return "Graded, no due date: answers are shown after the student's last allowed attempt."
  return 'Graded with unlimited attempts and no due date: answers are never shown (score only).'
}

// Instructor/admin: build one quiz. Route: /{instructor|admin}/courses/:courseId/quizzes/:quizId
export default function QuizEditorPage() {
  const { courseId = '', quizId = '' } = useParams()
  const isAdmin = useAuth().user?.role === 'admin'
  const coursePath = `${isAdmin ? '/admin' : '/instructor'}/courses/${courseId}`
  const { data, error, isLoading } = useQuizForEditingQuery({ courseId, quizId })

  const back = (
    <Link to={coursePath} className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2.5' })}>
      <ArrowLeft aria-hidden="true" />
      {data?.course.title ?? 'Course'}
    </Link>
  )
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <CardContent className="py-6 text-center text-sm text-red-700 dark:text-red-300">
            {parseApiError(error).message}
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
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  const { quiz } = data
  return (
    <div className="space-y-6">
      <PageMeta title={`Edit: ${quiz.title}`} />
      <div className="space-y-2">
        {back}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{quiz.title}</h1>
          <Badge variant="secondary">{quiz.kind === 'graded' ? 'Graded' : 'Practice'}</Badge>
          <LessonStatusBadge status={quiz.status} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'} · {quiz.totalPoints}{' '}
            {quiz.totalPoints === 1 ? 'point' : 'points'}
          </p>
          <Link to={`${coursePath}/quizzes/${quiz.id}/results`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <BarChart3 aria-hidden="true" />
            Results
          </Link>
        </div>
      </div>

      <PublishBar data={data} courseId={courseId} coursePath={coursePath} />
      {/* key: a different quiz starts a fresh settings form. */}
      <SettingsCard key={quiz.id} data={data} courseId={courseId} />
      <QuestionsCard quiz={quiz} topics={data.topics} courseId={courseId} />
    </div>
  )
}

function PublishBar({ data, courseId, coursePath }: { data: QuizEditorData; courseId: string; coursePath: string }) {
  const { quiz, publishProblems } = data
  const navigate = useNavigate()
  const [updateQuiz, { isLoading }] = useUpdateQuizMutation()
  const [deleteQuiz, deleting] = useDeleteQuizMutation()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const published = quiz.status === 'published'

  const setStatus = async (status: 'draft' | 'published') => {
    try {
      toast.success((await updateQuiz({ courseId, quizId: quiz.id, changes: { status } }).unwrap()).message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const doDelete = async () => {
    try {
      toast.success((await deleteQuiz({ courseId, quizId: quiz.id }).unwrap()).message)
      void navigate(coursePath, { replace: true })
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <div className="min-w-0 flex-1 text-sm">
        {published ? (
          <p>Published: students of this course can take it.</p>
        ) : publishProblems.length ? (
          <p>
            <span className="font-medium">Draft.</span> Before publishing: {publishProblems.join('; ')}.
          </p>
        ) : (
          <p>
            <span className="font-medium">Draft.</span> Only you can see it. Publish it when it's ready.
          </p>
        )}
      </div>
      {published ? (
        <Button variant="outline" size="sm" disabled={isLoading} onClick={() => void setStatus('draft')}>
          <EyeOff aria-hidden="true" />
          Move to draft
        </Button>
      ) : (
        <Button size="sm" disabled={isLoading || publishProblems.length > 0} onClick={() => void setStatus('published')}>
          <Send aria-hidden="true" />
          Publish
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-red-700 hover:text-red-800 dark:text-red-300"
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 aria-hidden="true" />
        Delete quiz
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {quiz.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The quiz and its {quiz.questions.length} {quiz.questions.length === 1 ? 'question are' : 'questions are'}{' '}
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton
              type="button"
              variant="destructive"
              className="sm:w-auto"
              loading={deleting.isLoading}
              loadingText="Deleting…"
              onClick={() => void doDelete()}
            >
              Delete quiz
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Text-field values of the settings form (numbers as typed).
function formValues(quiz: Quiz) {
  return {
    title: quiz.title,
    placement: quiz.module ?? COURSE_TEST,
    kind: quiz.kind,
    timeLimit: quiz.timeLimitMinutes ? String(quiz.timeLimitMinutes) : '',
    attempts: quiz.maxAttempts ? String(quiz.maxAttempts) : '',
    passPercent: String(quiz.passPercent),
    dueAt: toLocalInput(quiz.dueAt),
    reveal: quiz.reveal,
    shuffleQuestions: quiz.shuffleQuestions,
    shuffleOptions: quiz.shuffleOptions,
    instructions: quiz.instructions,
  }
}
type FormValues = ReturnType<typeof formValues>

function SettingsCard({ data, courseId }: { data: QuizEditorData; courseId: string }) {
  const { quiz, modules } = data
  const [values, setValues] = useState<FormValues>(() => formValues(quiz))
  const [saved, setSaved] = useState<FormValues>(values)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [updateQuiz, { isLoading }] = useUpdateQuizMutation()
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const problems: Partial<Record<string, string>> = {}
    const num = (s: string) => (s.trim() === '' ? null : Number(s))
    const timeLimit = num(values.timeLimit)
    const attempts = num(values.attempts)
    const pass = Number(values.passPercent)
    if (values.title.trim().length < 2) problems.title = 'Title must be at least 2 characters'
    if (timeLimit !== null && (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 300))
      problems.timeLimit = 'Minutes: a whole number from 1 to 300, or empty for no limit'
    if (attempts !== null && (!Number.isInteger(attempts) || attempts < 1 || attempts > 20))
      problems.attempts = 'A whole number from 1 to 20, or empty for unlimited'
    if (!Number.isInteger(pass) || pass < 0 || pass > 100) problems.passPercent = 'A whole number from 0 to 100'
    if (Object.keys(problems).length) {
      setErrors(problems)
      return
    }
    try {
      const res = await updateQuiz({
        courseId,
        quizId: quiz.id,
        changes: {
          title: values.title.trim(),
          module: values.placement === COURSE_TEST ? null : values.placement,
          kind: values.kind,
          timeLimitMinutes: timeLimit,
          maxAttempts: attempts,
          passPercent: pass,
          dueAt: fromLocalInput(values.dueAt),
          reveal: values.reveal,
          shuffleQuestions: values.shuffleQuestions,
          shuffleOptions: values.shuffleOptions,
          instructions: values.instructions,
        },
      }).unwrap()
      setSaved(values)
      toast.success(res.message)
    } catch (err) {
      const { message, fields } = parseApiError(err)
      // Server field names → form field names.
      const map: Record<string, string> = { timeLimitMinutes: 'timeLimit', maxAttempts: 'attempts', module: 'placement' }
      if (Object.keys(fields).length) {
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [map[k] ?? k, v])))
      } else toast.error(message)
    }
  }

  const field = (id: string, key: string) => ({
    id,
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `${id}-error` : undefined,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Changes apply to attempts started after you save.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="s-title">Title</Label>
              <Input {...field('s-title', 'title')} maxLength={150} value={values.title} onChange={(e) => set('title', e.target.value)} />
              <FieldError id="s-title-error" message={errors.title} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-placement">Where</Label>
              <SimpleSelect
                id="s-placement"
                value={values.placement}
                onChange={(v) => set('placement', v)}
                invalid={!!errors.placement}
                items={[
                  { value: COURSE_TEST, label: 'Course test (not in a module)' },
                  ...modules.map((m) => ({ value: m.id, label: `Module: ${m.title}` })),
                ]}
              />
              <FieldError id="s-placement-error" message={errors.placement} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-kind">Type</Label>
              <SimpleSelect
                id="s-kind"
                value={values.kind}
                onChange={(v) => set('kind', v)}
                items={[
                  { value: 'practice', label: 'Practice' },
                  { value: 'graded', label: 'Graded' },
                ]}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-due">
                Due date <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input {...field('s-due', 'dueAt')} type="datetime-local" value={values.dueAt} onChange={(e) => set('dueAt', e.target.value)} />
              <FieldError id="s-due-error" message={errors.dueAt} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-time">
                Time limit, minutes <span className="font-normal text-muted-foreground">(empty: none)</span>
              </Label>
              <Input
                {...field('s-time', 'timeLimit')}
                type="number"
                min={1}
                max={300}
                inputMode="numeric"
                value={values.timeLimit}
                onChange={(e) => set('timeLimit', e.target.value)}
              />
              <FieldError id="s-time-error" message={errors.timeLimit} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-attempts">
                Attempts allowed <span className="font-normal text-muted-foreground">(empty: unlimited)</span>
              </Label>
              <Input
                {...field('s-attempts', 'attempts')}
                type="number"
                min={1}
                max={20}
                inputMode="numeric"
                value={values.attempts}
                onChange={(e) => set('attempts', e.target.value)}
              />
              <FieldError id="s-attempts-error" message={errors.attempts} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-pass">Pass mark, %</Label>
              <Input
                {...field('s-pass', 'passPercent')}
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={values.passPercent}
                onChange={(e) => set('passPercent', e.target.value)}
              />
              <FieldError id="s-pass-error" message={errors.passPercent} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-reveal">Show correct answers</Label>
              <SimpleSelect
                id="s-reveal"
                value={values.reveal}
                onChange={(v) => set('reveal', v as RevealMode)}
                describedBy="s-reveal-help"
                items={(Object.keys(REVEAL_LABEL) as RevealMode[]).map((r) => ({ value: r, label: REVEAL_LABEL[r] }))}
              />
              <p id="s-reveal-help" className="text-xs text-muted-foreground">
                {values.reveal === 'auto'
                  ? autoRevealText(values.kind, !!values.dueAt, values.attempts ? Number(values.attempts) : null)
                  : values.reveal === 'after_due' && !values.dueAt
                    ? 'No due date is set, so students will never see the answers. Set a due date, or choose another option.'
                    : 'Explanations are shown together with the answers.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={values.shuffleQuestions}
                onChange={(e) => set('shuffleQuestions', e.target.checked)}
              />
              Shuffle question order for each student
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={values.shuffleOptions}
                onChange={(e) => set('shuffleOptions', e.target.checked)}
              />
              Shuffle answer options
            </label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="s-instructions">
              Instructions <span className="font-normal text-muted-foreground">(optional, shown before starting)</span>
            </Label>
            <Textarea
              {...field('s-instructions', 'instructions')}
              rows={3}
              maxLength={5000}
              value={values.instructions}
              placeholder="e.g. Answer all questions. Calculators are allowed."
              onChange={(e) => set('instructions', e.target.value)}
            />
            <FieldError id="s-instructions-error" message={errors.instructions} />
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton loading={isLoading} loadingText="Saving…" disabled={!dirty || isLoading} className="sm:w-auto">
              Save settings
            </SubmitButton>
            {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// A short, plain-text preview of a question for the list.
const preview = (text: string) => {
  // Drop Markdown marks (`code`, **bold**, # heading) but keep the words, e.g. arr[i].
  const plain = text.replace(/[`*_#>]/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > 140 ? `${plain.slice(0, 140)}…` : plain
}

function answerSummary(q: Question) {
  switch (q.type) {
    case 'single':
    case 'multiple':
      return `Correct: ${q.options.filter((o) => q.correctOptions.includes(o.id)).map((o) => o.text).join(', ')}`
    case 'true_false':
      return `Correct: ${q.correctBool ? 'True' : 'False'}`
    case 'short':
      return q.answerMode === 'number'
        ? `Correct: ${q.numericAnswer}${q.tolerance ? ` ± ${q.tolerance}` : ''}`
        : `Accepted: ${(q.acceptedAnswers ?? []).join(' / ')}`
  }
}

function QuestionsCard({ quiz, topics, courseId }: { quiz: Quiz; topics: string[]; courseId: string }) {
  const [editing, setEditing] = useState<Question | 'new' | null>(null)
  const [removing, setRemoving] = useState<Question | null>(null)
  const [deleteQuestion, deleting] = useDeleteQuestionMutation()
  const [reorder] = useReorderQuestionsMutation()
  const full = quiz.questions.length >= MAX_QUESTIONS

  const doRemove = async () => {
    if (!removing) return
    try {
      toast.success((await deleteQuestion({ courseId, quizId: quiz.id, questionId: removing.id }).unwrap()).message)
      setRemoving(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Questions</CardTitle>
        <CardDescription>
          {quiz.questions.length
            ? `${quiz.questions.length} ${quiz.questions.length === 1 ? 'question' : 'questions'}, ${quiz.totalPoints} ${quiz.totalPoints === 1 ? 'point' : 'points'} in total.`
            : 'No questions yet.'}
        </CardDescription>
        <CardAction>
          <Button size="sm" disabled={full} onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Add question
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {quiz.questions.length > 0 && (
          <ol className="divide-y rounded-lg border" aria-label="Questions">
            {quiz.questions.map((q, i) => (
              <li key={q.id} className="flex items-start gap-3 px-3 py-3">
                <span className="mt-0.5 w-6 shrink-0 text-sm font-medium text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm break-words">{preview(q.text)}</p>
                  <p className="text-xs text-muted-foreground break-words">{answerSummary(q)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                    <Badge variant="outline">
                      {q.points} {q.points === 1 ? 'pt' : 'pts'}
                    </Badge>
                    {q.topic && <Badge variant="secondary">{q.topic}</Badge>}
                  </div>
                </div>
                <MoveButtons
                  label={`question ${i + 1}`}
                  index={i}
                  count={quiz.questions.length}
                  onMove={(by) =>
                    void reorder({ courseId, quizId: quiz.id, ids: moved(quiz.questions.map((x) => x.id), i, by) })
                      .unwrap()
                      .catch((err: unknown) => toast.error(parseApiError(err).message))
                  }
                />
                <Button variant="ghost" size="icon-sm" aria-label={`Edit question ${i + 1}`} onClick={() => setEditing(q)}>
                  <Pencil aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete question ${i + 1}`} onClick={() => setRemoving(q)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
        )}
        {full && <p className="mt-3 text-sm text-muted-foreground">Limit reached: {MAX_QUESTIONS} questions per quiz.</p>}
      </CardContent>

      <QuestionDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        courseId={courseId}
        quizId={quiz.id}
        question={editing && editing !== 'new' ? editing : undefined}
        topics={topics}
      />

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>{removing ? preview(removing.text) : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton
              type="button"
              variant="destructive"
              className="sm:w-auto"
              loading={deleting.isLoading}
              loadingText="Deleting…"
              onClick={() => void doRemove()}
            >
              Delete question
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
