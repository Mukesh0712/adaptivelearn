import { useState } from 'react'
import { Link } from 'react-router'
import { ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/dates'
import type { StudentQuizItem } from './types'

// One quiz in the student's course outline: what it is and where they stand.
export function StudentQuizRow({ quiz, courseId }: { quiz: StudentQuizItem; courseId: string }) {
  // The time when the page opened is precise enough for "due" vs "closed".
  const [openedAt] = useState(() => Date.now())
  const overdue = !!quiz.dueAt && new Date(quiz.dueAt).getTime() < openedAt
  return (
    <Link
      to={`/student/courses/${courseId}/quizzes/${quiz.id}`}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-2 text-sm hover:bg-muted"
    >
      <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block break-words">
          <span className="sr-only">Quiz: </span>
          {quiz.title}
        </span>
        <span className="block text-xs text-muted-foreground">
          {quiz.kind === 'graded' ? 'Graded' : 'Practice'} · {quiz.questionCount}{' '}
          {quiz.questionCount === 1 ? 'question' : 'questions'}
          {quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} min` : ''}
          {quiz.dueAt ? ` · ${overdue ? 'closed' : 'due'} ${formatDateTime(quiz.dueAt)}` : ''}
        </span>
      </span>
      {quiz.inProgress ? (
        <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">In progress</Badge>
      ) : quiz.bestPercent !== null ? (
        <Badge variant="secondary">Best {quiz.bestPercent}%</Badge>
      ) : (
        <Badge variant="outline">Not started</Badge>
      )}
    </Link>
  )
}
