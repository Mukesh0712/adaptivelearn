import { useState } from 'react'
import { BookOpen, ChevronDown, Plus } from 'lucide-react'
import { PageMeta } from '@/components/PageMeta'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseApiError } from '@/features/auth/apiError'
import { CourseCard } from '@/features/courses/CourseCard'
import { CourseFormDialog } from '@/features/courses/CourseFormDialog'
import { useMyCoursesQuery } from '@/features/courses/coursesApi'
import { cn } from '@/lib/utils'

const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'

// Instructor → My courses: create, edit, archive; shows each join code.
export default function CoursesPage() {
  const { data, error, isLoading, refetch } = useMyCoursesQuery()
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const active = data?.courses.filter((c) => c.status === 'active') ?? []
  const archived = data?.courses.filter((c) => c.status === 'archived') ?? []

  return (
    <div className="space-y-6">
      <PageMeta title="My courses" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My courses</h1>
          <p className="text-muted-foreground">Create courses and share their join codes with your students.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          New course
        </Button>
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
      ) : isLoading ? (
        <div className={GRID}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BookOpen className="size-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">{archived.length ? 'No active courses' : 'No courses yet'}</p>
              <p className="text-sm text-muted-foreground">Create your first course to get a join code.</p>
            </div>
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              New course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={GRID}>
          {active.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="space-y-4">
          <Button
            variant="ghost"
            className="-ml-2.5"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            <ChevronDown className={cn('transition-transform', !showArchived && '-rotate-90')} aria-hidden="true" />
            Archived ({archived.length})
          </Button>
          {showArchived && (
            <div className={GRID}>
              {archived.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </section>
      )}

      <CourseFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
