import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bot, Send, Sparkles, Trash2 } from 'lucide-react'
import { SubmitButton } from '@/components/SubmitButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseApiError } from '@/features/auth/apiError'
import { Markdown } from '@/features/content/Markdown'
import { cn } from '@/lib/utils'
import { useAiMeQuery, useLessonChatMutation, type ChatTurn } from './aiApi'

const QUESTION_MAX = 500
// How many earlier messages go with each question (the server takes up to 6).
const HISTORY_SENT = 6

// Student lesson page: ask questions about THIS lesson. The AI answers from
// the lesson text only. The chat is kept in this page only: it is not saved,
// and it starts fresh on the next lesson.
export function StudyAssistant({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { data: ai } = useAiMeQuery()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [question, setQuestion] = useState('')
  const [chat, { isLoading, error, reset }] = useLessonChatMutation()
  const [left, setLeft] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const end = useRef<HTMLDivElement>(null)

  // Keep the newest message in view.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, isLoading])

  if (!ai?.enabled) return null

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || isLoading) return
    reset()
    const history = messages.slice(-HISTORY_SENT)
    setMessages((m) => [...m, { role: 'student', text: q }])
    setQuestion('')
    try {
      const res = await chat({ courseId, lessonId, question: q, history }).unwrap()
      setMessages((m) => [...m, { role: 'assistant', text: res.answer }])
      setLeft(res.left)
    } catch {
      // Not answered: take the question back out of the chat and into the
      // box, so the student can try again without retyping it.
      setMessages((m) => m.slice(0, -1))
      setQuestion(q)
    }
    input.current?.focus()
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-4" aria-hidden="true" />
          Study assistant
        </CardTitle>
        <CardDescription>Ask questions about this lesson. Answers come from the lesson text only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!open ? (
          <Button
            variant="outline"
            onClick={() => {
              setOpen(true)
              setTimeout(() => input.current?.focus())
            }}
          >
            <Sparkles aria-hidden="true" />
            Ask about this lesson
          </Button>
        ) : (
          <>
            {/* role="log": screen readers read out each new message as it arrives. */}
            <div role="log" aria-label="Conversation" className="max-h-96 space-y-3 overflow-y-auto">
              {!messages.length && !isLoading && (
                <p className="text-sm text-muted-foreground">
                  For example: "Explain the main idea in simpler words" or "Give me an example".
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm',
                    m.role === 'student'
                      ? 'ml-auto w-fit max-w-[85%] bg-primary text-primary-foreground'
                      : 'max-w-[95%] border border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30',
                  )}
                >
                  <p className={cn('text-xs font-medium', m.role === 'student' ? 'sr-only' : 'mb-1 text-muted-foreground')}>
                    {m.role === 'student' ? 'You:' : 'Assistant:'}
                  </p>
                  {m.role === 'student' ? (
                    <p className="break-words whitespace-pre-wrap">{m.text}</p>
                  ) : (
                    <Markdown noLinks>{m.text}</Markdown>
                  )}
                </div>
              ))}
              {isLoading && <p className="text-sm text-muted-foreground">Thinking…</p>}
              <div ref={end} />
            </div>

            {error && (
              <p className="text-sm text-red-700 dark:text-red-300" role="alert">
                {parseApiError(error).message}
              </p>
            )}

            <form onSubmit={(e) => void send(e)} className="flex gap-2">
              <Label htmlFor={`ask-${lessonId}`} className="sr-only">
                Your question
              </Label>
              <Input
                id={`ask-${lessonId}`}
                ref={input}
                value={question}
                maxLength={QUESTION_MAX}
                autoComplete="off"
                placeholder="Ask a question about this lesson"
                onChange={(e) => setQuestion(e.target.value)}
              />
              <SubmitButton
                className="w-auto shrink-0"
                loading={isLoading}
                loadingText="Asking…"
                disabled={!question.trim()}
                aria-label="Send question"
              >
                <Send aria-hidden="true" />
                <span className="hidden sm:inline">Send</span>
              </SubmitButton>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                AI can make mistakes: check with the lesson or your instructor.
                {left !== null && ` ${left} ${left === 1 ? 'AI request' : 'AI requests'} left today.`}
              </span>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMessages([])
                    reset()
                    input.current?.focus()
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Clear chat
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
