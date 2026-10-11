import { RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { cn } from '@/lib/utils'
import { useAiStatusQuery } from './adminApi'

// Admin dashboard: is the AI service set up and answering?
export function AiStatusCard() {
  const { data, error, isLoading, isFetching, refetch } = useAiStatusQuery()

  const state = !data ? null : !data.configured ? 'off' : data.reachable ? 'ok' : 'down'
  const label = { ok: 'Working', down: 'Not answering', off: 'Not set up' }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" aria-hidden="true" />
          AI service
        </CardTitle>
        <CardDescription>Answers students' questions and helps instructors write content.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            <RefreshCw className={cn(isFetching && 'animate-spin')} aria-hidden="true" />
            {isFetching ? 'Checking…' : 'Check again'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 text-sm" aria-live="polite" aria-busy={isFetching}>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            {/* The first check can take a while if the free service was asleep. */}
            <p className="text-muted-foreground">Checking… this can take up to a minute if the service was asleep.</p>
          </div>
        ) : error || !data || !state ? (
          <p className="text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-medium">
              <span
                aria-hidden="true"
                className={cn(
                  'size-2.5 rounded-full',
                  state === 'ok' ? 'bg-green-600' : state === 'down' ? 'bg-amber-500' : 'bg-muted-foreground/50',
                )}
              />
              {label[state]}
            </p>
            {state === 'ok' && (
              <p className="text-muted-foreground">
                Model: {data.provider} · {data.model} · answered in {((data.responseMs ?? 0) / 1000).toFixed(1)} s
                {data.provider === 'mock' && (
                  <span className="mt-1 block">Sample answers only, no real AI yet. A real model is connected later.</span>
                )}
              </p>
            )}
            {state === 'down' && <p className="text-muted-foreground">{data.problem}</p>}
            {state === 'off' && (
              <p className="text-muted-foreground">
                AI features are off. To switch them on, set AI_SERVICE_URL and AI_SERVICE_SECRET on the server.
              </p>
            )}
            <p className="text-muted-foreground">
              Daily limit per person: {data.limits.studentDaily} AI requests for students,{' '}
              {data.limits.instructorDaily} for instructors.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
