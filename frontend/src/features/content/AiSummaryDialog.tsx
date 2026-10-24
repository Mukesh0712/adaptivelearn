import { useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
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
import { parseApiError } from '@/features/auth/apiError'
import { useAiMeQuery, useSummarizeLessonMutation } from '@/features/ai/aiApi'
import { Markdown } from './Markdown'
import { LESSON_CONTENT_MAX } from './types'

// Lesson editor: the AI writes a summary of the SAVED lesson text. The
// instructor reads it and may add it to the top of the lesson; it is only
// saved when they press Save, like any other edit.
export function AiSummaryButton({
  courseId,
  lessonId,
  dirty,
  content,
  onInsert,
}: {
  courseId: string
  lessonId: string
  dirty: boolean
  content: string
  onInsert: (newContent: string) => void
}) {
  const { data: ai } = useAiMeQuery()
  const [open, setOpen] = useState(false)
  const [summarize, { data, error, isLoading, reset }] = useSummarizeLessonMutation()

  if (!ai?.enabled) return null

  const block = data ? `## Summary\n\n${data.summary}\n\n` : ''
  const tooLong = content.length + block.length > LESSON_CONTENT_MAX
  const ask = () => {
    reset()
    void summarize({ courseId, lessonId })
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true)
          if (!dirty) ask()
        }}
      >
        <Sparkles aria-hidden="true" />
        AI summary
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>AI summary</DialogTitle>
            <DialogDescription>Key points of the saved lesson, for students to revise from. Check it before adding.</DialogDescription>
          </DialogHeader>
          <div aria-live="polite" aria-busy={isLoading} className="text-sm">
            {dirty && !data && !isLoading && !error ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2">
                You have unsaved changes. The AI reads the saved lesson, so save first, then ask again.
              </p>
            ) : isLoading ? (
              <p className="text-muted-foreground">Writing the summary… this can take up to a minute.</p>
            ) : error ? (
              <p className="text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
            ) : data ? (
              <div className="space-y-2">
                <div className="rounded-lg border px-3 py-2">
                  <Markdown noLinks>{data.summary}</Markdown>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI can make mistakes: check every point against the lesson. {data.left}{' '}
                  {data.left === 1 ? 'AI request' : 'AI requests'} left today.
                </p>
                {tooLong && (
                  <p className="text-red-700 dark:text-red-300">
                    The lesson would become longer than {LESSON_CONTENT_MAX.toLocaleString('en-IN')} characters. Copy
                    the points you need instead.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
            {!dirty && (data || error) && (
              <Button type="button" variant="outline" disabled={isLoading} onClick={ask}>
                <RefreshCw aria-hidden="true" />
                Try again
              </Button>
            )}
            {data && (
              <Button
                type="button"
                disabled={tooLong}
                onClick={() => {
                  onInsert(block + content)
                  setOpen(false)
                }}
              >
                Add to the top of the lesson
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
