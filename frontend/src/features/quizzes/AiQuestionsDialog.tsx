import { useState } from 'react'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { SimpleSelect } from '@/components/SimpleSelect'
import { SubmitButton } from '@/components/SubmitButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { parseApiError } from '@/features/auth/apiError'
import { useAiMeQuery, useGenerateQuestionsMutation, type DraftQuestionType } from '@/features/ai/aiApi'
import { useCourseContentQuery } from '@/features/content/contentApi'
import { Markdown } from '@/features/content/Markdown'
import { cn } from '@/lib/utils'
import { useAddQuestionsMutation } from './quizApi'
import { QUESTION_TYPE_LABEL, type QuestionInput } from './types'

const TYPES: DraftQuestionType[] = ['single', 'multiple', 'true_false', 'short']
type Difficulty = 'easy' | 'medium' | 'hard'

// Quiz editor: the AI drafts questions from one lesson. The instructor
// reviews them, unticks any they don't want, and only then adds them.
export function AiQuestionsButton({
  courseId,
  quizId,
  moduleId,
  room,
}: {
  courseId: string
  quizId: string
  moduleId: string | null
  room: number // how many more questions the quiz can take
}) {
  const { data: ai } = useAiMeQuery()
  const [open, setOpen] = useState(false)
  if (!ai?.enabled || room <= 0) return null
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles aria-hidden="true" />
        Generate with AI
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {/* Mounted only while open, so each opening starts fresh. */}
          {open && (
            <Generator courseId={courseId} quizId={quizId} moduleId={moduleId} room={room} onDone={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Generator({
  courseId,
  quizId,
  moduleId,
  room,
  onDone,
}: {
  courseId: string
  quizId: string
  moduleId: string | null
  room: number
  onDone: () => void
}) {
  const { data: content } = useCourseContentQuery(courseId)
  const modules = content?.modules ?? []
  // Lessons of the quiz's own module first.
  const lessons = [...modules]
    .sort((a, b) => Number(b.id === moduleId) - Number(a.id === moduleId))
    .flatMap((m) => m.lessons.map((l) => ({ value: l.id, label: `${m.title}: ${l.title}` })))

  const [lessonId, setLessonId] = useState('')
  const [count, setCount] = useState(String(Math.min(5, room)))
  const [types, setTypes] = useState<DraftQuestionType[]>(['single', 'true_false'])
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [formError, setFormError] = useState('')
  const [chosen, setChosen] = useState<boolean[]>([])
  const [generate, gen] = useGenerateQuestionsMutation()
  const [addQuestions, adding] = useAddQuestionsMutation()
  const lesson = lessonId || lessons[0]?.value || ''
  const drafts = gen.data?.questions

  const run = async () => {
    if (!lesson) return setFormError('This course has no lessons yet.')
    if (!types.length) return setFormError('Choose at least one question type.')
    setFormError('')
    try {
      const res = await generate({ courseId, quizId, lessonId: lesson, count: Number(count), types, difficulty }).unwrap()
      setChosen(res.questions.map(() => true))
    } catch {
      // Shown from gen.error below.
    }
  }

  const add = async () => {
    const picked = (drafts ?? []).filter((_, i) => chosen[i])
    try {
      toast.success((await addQuestions({ courseId, quizId, questions: picked }).unwrap()).message)
      onDone()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const counts = [1, 3, 5, 10].filter((n) => n <= room)
  const picked = chosen.filter(Boolean).length

  // Step 2: review the drafts.
  if (drafts && !gen.isLoading) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Review the AI's questions</DialogTitle>
          <DialogDescription>
            Untick any you don't want. AI can make mistakes: check every answer. You can edit them after adding.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3" aria-label="Draft questions">
          {drafts.map((q, i) => (
            <li key={i}>
              <DraftCard
                q={q}
                index={i}
                checked={!!chosen[i]}
                onToggle={() => setChosen((c) => c.map((v, j) => (j === i ? !v : v)))}
              />
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          {gen.data!.dropped > 0 &&
            `${gen.data!.dropped} ${gen.data!.dropped === 1 ? 'question was' : 'questions were'} left out because ${gen.data!.dropped === 1 ? 'it' : 'they'} didn't pass the checks. `}
          {gen.data!.left} {gen.data!.left === 1 ? 'AI request' : 'AI requests'} left today.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => gen.reset()}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
          <SubmitButton
            type="button"
            className="sm:w-auto"
            loading={adding.isLoading}
            loadingText="Adding…"
            disabled={!picked}
            onClick={() => void add()}
          >
            Add {picked} {picked === 1 ? 'question' : 'questions'}
          </SubmitButton>
        </DialogFooter>
      </>
    )
  }

  // Step 1: what to write.
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void run()
      }}
    >
      <DialogHeader>
        <DialogTitle>Generate questions with AI</DialogTitle>
        <DialogDescription>
          The AI reads one saved lesson and drafts questions about it. Nothing is added until you choose.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="ai-lesson">From lesson</Label>
        {lessons.length ? (
          <SimpleSelect id="ai-lesson" value={lesson} onChange={setLessonId} items={lessons} />
        ) : (
          <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="ai-count">How many</Label>
          <SimpleSelect
            id="ai-count"
            value={count}
            onChange={setCount}
            items={counts.map((n) => ({ value: String(n), label: `${n} ${n === 1 ? 'question' : 'questions'}` }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ai-difficulty">Difficulty</Label>
          <SimpleSelect
            id="ai-difficulty"
            value={difficulty}
            onChange={setDifficulty}
            items={[
              { value: 'easy', label: 'Easy: main ideas' },
              { value: 'medium', label: 'Medium: recall and apply' },
              { value: 'hard', label: 'Hard: apply and reason' },
            ]}
          />
        </div>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Question types</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={types.includes(t)}
                onChange={() => {
                  setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
                  setFormError('')
                }}
              />
              {QUESTION_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <div aria-live="polite" className="text-sm">
        {formError ? (
          <p className="text-red-700 dark:text-red-300">{formError}</p>
        ) : gen.isLoading ? (
          <p className="text-muted-foreground">Writing questions… this can take up to a minute.</p>
        ) : gen.error ? (
          <p className="text-red-700 dark:text-red-300">{parseApiError(gen.error).message}</p>
        ) : null}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton className="sm:w-auto" loading={gen.isLoading} loadingText="Generating…" disabled={!lessons.length}>
          <Sparkles aria-hidden="true" />
          Generate
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}

// One draft: everything the instructor needs to judge it.
function DraftCard({ q, index, checked, onToggle }: { q: QuestionInput; index: number; checked: boolean; onToggle: () => void }) {
  const id = `draft-${index}`
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-sm', !checked && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-primary"
          checked={checked}
          onChange={onToggle}
          aria-describedby={`${id}-text`}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={id} className="flex flex-wrap items-center gap-2 font-medium">
            Question {index + 1}
            <Badge variant="outline">{QUESTION_TYPE_LABEL[q.type]}</Badge>
            {q.topic && <Badge variant="secondary">{q.topic}</Badge>}
          </label>
          <div id={`${id}-text`}>
            <Markdown noLinks>{q.text}</Markdown>
          </div>
          {(q.type === 'single' || q.type === 'multiple') && (
            <ul className="grid gap-1">
              {q.options.map((o, i) => {
                const right = q.correct.includes(i)
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex items-start gap-2 rounded-md border px-2 py-1 break-words',
                      right && 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
                    )}
                  >
                    <span className="flex-1">{o}</span>
                    {right && (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                        <Check className="size-3" aria-hidden="true" />
                        Correct
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {q.type === 'true_false' && (
            <p className="text-emerald-800 dark:text-emerald-200">Correct: {q.correctBool ? 'True' : 'False'}</p>
          )}
          {q.type === 'short' && q.answerMode === 'text' && (
            <p className="text-emerald-800 dark:text-emerald-200">Accepted: {q.acceptedAnswers.join(' / ')}</p>
          )}
          {q.explanation && <p className="text-muted-foreground">Explanation: {q.explanation}</p>}
        </div>
      </div>
    </div>
  )
}
