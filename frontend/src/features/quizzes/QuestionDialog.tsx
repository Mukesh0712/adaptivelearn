import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { SimpleSelect } from '@/components/SimpleSelect'
import { SubmitButton } from '@/components/SubmitButton'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FieldError } from '@/features/auth/pages/AuthCard'
import { parseApiError } from '@/features/auth/apiError'
import { useAddQuestionMutation, useUpdateQuestionMutation } from './quizApi'
import { QUESTION_TYPE_LABEL, type Question, type QuestionInput, type QuestionType } from './types'

const MAX_OPTIONS: Record<'single' | 'multiple', number> = { single: 6, multiple: 8 }
type Errors = Partial<Record<string, string>>

// build() returns either the question or the problems found.
const isInput = (r: QuestionInput | Errors): r is QuestionInput => typeof (r as { type?: unknown }).type === 'string'

// Add a question (no `question`) or edit one. Mounted only while open, so
// the form always starts from the question being edited.
export function QuestionDialog({
  open,
  onOpenChange,
  courseId,
  quizId,
  question,
  topics,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  quizId: string
  question?: Question
  topics: string[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {open && (
          <QuestionForm
            courseId={courseId}
            quizId={quizId}
            question={question}
            topics={topics}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function QuestionForm({
  courseId,
  quizId,
  question,
  topics,
  onDone,
}: {
  courseId: string
  quizId: string
  question?: Question
  topics: string[]
  onDone: () => void
}) {
  const [type, setType] = useState<QuestionType>(question?.type ?? 'single')
  const [text, setText] = useState(question?.text ?? '')
  const [points, setPoints] = useState(String(question?.points ?? 1))
  const [topic, setTopic] = useState(question?.topic ?? '')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [options, setOptions] = useState<string[]>(question?.options.length ? question.options.map((o) => o.text) : ['', ''])
  const [correct, setCorrect] = useState<number[]>(
    question ? question.options.flatMap((o, i) => (question.correctOptions.includes(o.id) ? [i] : [])) : [],
  )
  const [partialCredit, setPartialCredit] = useState(question?.partialCredit ?? false)
  const [correctBool, setCorrectBool] = useState<boolean | null>(question?.correctBool ?? null)
  const [answerMode, setAnswerMode] = useState<'text' | 'number'>(question?.answerMode ?? 'text')
  const [accepted, setAccepted] = useState((question?.acceptedAnswers ?? []).join('\n'))
  const [numeric, setNumeric] = useState(question?.numericAnswer !== undefined ? String(question.numericAnswer) : '')
  const [tolerance, setTolerance] = useState(String(question?.tolerance ?? 0))
  const [errors, setErrors] = useState<Errors>({})
  const [addQuestion, adding] = useAddQuestionMutation()
  const [updateQuestion, updating] = useUpdateQuestionMutation()
  const saving = adding.isLoading || updating.isLoading
  const hasOptions = type === 'single' || type === 'multiple'

  const clear = (field: string) => setErrors((e) => ({ ...e, [field]: undefined }))

  // Builds what the API expects, or returns the problems to show.
  const build = (): QuestionInput | Errors => {
    const problems: Errors = {}
    const common = { text: text.trim(), points: Number(points), topic: topic.trim(), explanation: explanation.trim() }
    if (!common.text) problems.text = 'Write the question'
    if (!Number.isInteger(common.points) || common.points < 1 || common.points > 100) problems.points = 'Points: a whole number from 1 to 100'
    if (hasOptions) {
      const opts = options.map((o) => o.trim())
      if (opts.some((o) => !o)) problems.options = 'Fill in every option, or remove the empty ones'
      else if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) problems.options = 'Two options are the same'
      if (type === 'single' && correct.length !== 1) problems.correct = 'Mark the correct option'
      if (type === 'multiple' && correct.length === 0) problems.correct = 'Mark at least one correct option'
      if (Object.keys(problems).length) return problems
      return type === 'single'
        ? { ...common, type, options: opts, correct }
        : { ...common, type, options: opts, correct, partialCredit }
    }
    if (type === 'true_false') {
      if (correctBool === null) problems.correctBool = 'Choose True or False'
      return Object.keys(problems).length ? problems : { ...common, type, correctBool: correctBool! }
    }
    if (answerMode === 'text') {
      const list = accepted.split('\n').map((a) => a.trim()).filter(Boolean)
      if (!list.length) problems.acceptedAnswers = 'Add at least one accepted answer'
      if (list.length > 10) problems.acceptedAnswers = 'At most 10 accepted answers'
      return Object.keys(problems).length ? problems : { ...common, type: 'short', answerMode: 'text', acceptedAnswers: list }
    }
    const value = Number(numeric)
    const tol = Number(tolerance || 0)
    if (numeric.trim() === '' || !Number.isFinite(value)) problems.numericAnswer = 'Enter the correct number'
    if (!Number.isFinite(tol) || tol < 0) problems.tolerance = 'Tolerance: 0 or more'
    return Object.keys(problems).length
      ? problems
      : { ...common, type: 'short', answerMode: 'number', numericAnswer: value, tolerance: tol }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = build()
    if (!isInput(result)) {
      setErrors(result)
      return
    }
    try {
      const res = question
        ? await updateQuestion({ courseId, quizId, questionId: question.id, question: result }).unwrap()
        : await addQuestion({ courseId, quizId, question: result }).unwrap()
      toast.success(res.message)
      onDone()
    } catch (err) {
      const { message, fields } = parseApiError(err)
      if (Object.keys(fields).length) setErrors(fields)
      else toast.error(message)
    }
  }

  const setOption = (i: number, value: string) => {
    setOptions((o) => o.map((x, j) => (j === i ? value : x)))
    clear('options')
  }
  const removeOption = (i: number) => {
    setOptions((o) => o.filter((_, j) => j !== i))
    // Keep the right options marked: indexes after i shift down by one.
    setCorrect((c) => c.filter((j) => j !== i).map((j) => (j > i ? j - 1 : j)))
  }
  const toggleCorrect = (i: number) => {
    setCorrect((c) => (type === 'single' ? [i] : c.includes(i) ? c.filter((j) => j !== i) : [...c, i].sort()))
    clear('correct')
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{question ? 'Edit question' : 'Add question'}</DialogTitle>
        <DialogDescription>Students never see the correct answer before they submit.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2 sm:grid-cols-[1fr_8rem] sm:gap-3">
        <div className="grid gap-2">
          <Label htmlFor="q-type">Question type</Label>
          <SimpleSelect
            id="q-type"
            value={type}
            onChange={(t) => {
              setType(t)
              setErrors({})
              if (t === 'single' && correct.length > 1) setCorrect(correct.slice(0, 1))
              if ((t === 'single' || t === 'multiple') && options.length > MAX_OPTIONS[t]) setOptions(options.slice(0, MAX_OPTIONS[t]))
            }}
            items={(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => ({ value: t, label: QUESTION_TYPE_LABEL[t] }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="q-points">Points</Label>
          <Input
            id="q-points"
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={points}
            aria-invalid={!!errors.points}
            aria-describedby={errors.points ? 'q-points-error' : undefined}
            onChange={(e) => {
              setPoints(e.target.value)
              clear('points')
            }}
          />
        </div>
        <FieldError id="q-points-error" message={errors.points} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="q-text">Question</Label>
        <Textarea
          id="q-text"
          value={text}
          maxLength={5000}
          rows={3}
          placeholder="e.g. What is the time complexity of reading arr[i]?"
          aria-invalid={!!errors.text}
          aria-describedby={errors.text ? 'q-text-error' : 'q-text-help'}
          onChange={(e) => {
            setText(e.target.value)
            clear('text')
          }}
        />
        <p id="q-text-help" className="text-xs text-muted-foreground">
          Markdown works here too, e.g. <code>`code`</code> or <code>**bold**</code>.
        </p>
        <FieldError id="q-text-error" message={errors.text} />
      </div>

      {hasOptions && (
        <fieldset className="grid gap-2" aria-describedby="q-options-help">
          <legend className="mb-1 text-sm font-medium">Options</legend>
          <p id="q-options-help" className="text-xs text-muted-foreground">
            {type === 'single' ? 'Select the one correct option.' : 'Tick every correct option.'}
          </p>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={type === 'single' ? 'radio' : 'checkbox'}
                name="q-correct"
                className="size-4 shrink-0 accent-primary"
                checked={correct.includes(i)}
                onChange={() => toggleCorrect(i)}
                aria-label={`Option ${i + 1} is correct`}
              />
              <Input
                value={o}
                maxLength={500}
                aria-label={`Option ${i + 1}`}
                aria-invalid={!!errors.options && !o.trim()}
                onChange={(e) => setOption(i, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove option ${i + 1}`}
                disabled={options.length <= 2}
                onClick={() => removeOption(i)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ))}
          {options.length < MAX_OPTIONS[type] && (
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setOptions((o) => [...o, ''])}>
              <Plus aria-hidden="true" />
              Add option
            </Button>
          )}
          <FieldError id="q-options-error" message={errors.options} />
          <FieldError id="q-correct-error" message={errors.correct} />
          {type === 'multiple' && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={partialCredit}
                onChange={(e) => setPartialCredit(e.target.checked)}
              />
              <span>
                Partial marks
                <span className="block text-xs text-muted-foreground">
                  Points for each right choice, minus wrong ones (never below 0). Off: all must be right.
                </span>
              </span>
            </label>
          )}
        </fieldset>
      )}

      {type === 'true_false' && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Correct answer</legend>
          <div className="flex gap-4">
            {[true, false].map((v) => (
              <label key={String(v)} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="q-bool"
                  className="size-4 accent-primary"
                  checked={correctBool === v}
                  onChange={() => {
                    setCorrectBool(v)
                    clear('correctBool')
                  }}
                />
                {v ? 'True' : 'False'}
              </label>
            ))}
          </div>
          <FieldError id="q-bool-error" message={errors.correctBool} />
        </fieldset>
      )}

      {type === 'short' && (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="q-mode">Answer is</Label>
            <SimpleSelect
              id="q-mode"
              value={answerMode}
              onChange={(m) => {
                setAnswerMode(m)
                setErrors({})
              }}
              items={[
                { value: 'text', label: 'A word or phrase' },
                { value: 'number', label: 'A number' },
              ]}
            />
          </div>
          {answerMode === 'text' ? (
            <div className="grid gap-2">
              <Label htmlFor="q-accepted">Accepted answers (one per line)</Label>
              <Textarea
                id="q-accepted"
                rows={3}
                value={accepted}
                placeholder={'stack\na stack'}
                aria-invalid={!!errors.acceptedAnswers}
                aria-describedby={errors.acceptedAnswers ? 'q-accepted-error' : 'q-accepted-help'}
                onChange={(e) => {
                  setAccepted(e.target.value)
                  clear('acceptedAnswers')
                }}
              />
              <p id="q-accepted-help" className="text-xs text-muted-foreground">
                Capital letters and extra spaces are ignored.
              </p>
              <FieldError id="q-accepted-error" message={errors.acceptedAnswers} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="q-number">Correct number</Label>
                <Input
                  id="q-number"
                  inputMode="decimal"
                  value={numeric}
                  aria-invalid={!!errors.numericAnswer}
                  aria-describedby={errors.numericAnswer ? 'q-number-error' : undefined}
                  onChange={(e) => {
                    setNumeric(e.target.value)
                    clear('numericAnswer')
                  }}
                />
                <FieldError id="q-number-error" message={errors.numericAnswer} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q-tolerance">Allowed difference (±)</Label>
                <Input
                  id="q-tolerance"
                  inputMode="decimal"
                  value={tolerance}
                  aria-invalid={!!errors.tolerance}
                  aria-describedby={errors.tolerance ? 'q-tolerance-error' : 'q-tolerance-help'}
                  onChange={(e) => {
                    setTolerance(e.target.value)
                    clear('tolerance')
                  }}
                />
                <p id="q-tolerance-help" className="text-xs text-muted-foreground">
                  0 = exact. E.g. answer 3.14 with ± 0.01 accepts 3.13 to 3.15.
                </p>
                <FieldError id="q-tolerance-error" message={errors.tolerance} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="q-topic">
          Topic <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="q-topic"
          list="q-topic-suggestions"
          maxLength={60}
          value={topic}
          placeholder="e.g. Arrays: indexing"
          aria-describedby="q-topic-help"
          onChange={(e) => setTopic(e.target.value)}
        />
        <datalist id="q-topic-suggestions">
          {topics.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <p id="q-topic-help" className="text-xs text-muted-foreground">
          The skill this question checks. Used later to show each student which topics they've mastered.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="q-explanation">
          Explanation <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="q-explanation"
          rows={2}
          maxLength={2000}
          value={explanation}
          placeholder="Why the answer is right. Shown when answers are revealed."
          onChange={(e) => setExplanation(e.target.value)}
        />
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton loading={saving} loadingText="Saving…" className="sm:w-auto">
          {question ? 'Save question' : 'Add question'}
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
