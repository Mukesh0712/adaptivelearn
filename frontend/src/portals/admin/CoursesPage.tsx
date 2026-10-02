import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Archive, ArchiveRestore, BookOpen, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageMeta } from '@/components/PageMeta'
import { Pagination } from '@/components/Pagination'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useListCoursesQuery, useSetAnyCourseStatusMutation } from '@/features/admin/adminApi'
import type { AdminCourse } from '@/features/admin/types'
import { parseApiError } from '@/features/auth/apiError'
import { CourseFormDialog } from '@/features/courses/CourseFormDialog'
import { DeleteCourseDialog } from '@/features/courses/DeleteCourseDialog'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10
const STATUS_ITEMS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })
const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

// Admin → Courses: every course on the platform; archive or restore any.
export default function AdminCoursesPage() {
  // Search, filter and page live in the URL, like the Users page.
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status = statusParam === 'active' || statusParam === 'archived' ? statusParam : undefined
  const page = Math.max(1, Number(params.get('page')) || 1)
  const urlQuery = params.get('q') ?? ''
  const [search, setSearch] = useState(urlQuery)
  const [creating, setCreating] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim())

  const updateParams = (changes: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page') // a new filter starts at page 1
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    if (debouncedSearch !== urlQuery) updateParams({ q: debouncedSearch || undefined })
    // updateParams is recreated each render; only a new search should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const { data, error, isLoading, isFetching, refetch } = useListCoursesQuery({
    q: urlQuery || undefined,
    status,
    page,
    pageSize: PAGE_SIZE,
  })

  return (
    <div className="space-y-6">
      <PageMeta title="Courses" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-muted-foreground">Every course on the platform. Search by title or course code.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          New course
        </Button>
      </div>
      <CourseFormDialog forAdmin open={creating} onOpenChange={setCreating} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search courses by title or code"
            placeholder="Search title or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            className="pl-8"
          />
        </div>
        <Select
          items={STATUS_ITEMS}
          value={status ?? 'all'}
          onValueChange={(v) => updateParams({ status: v === 'all' ? undefined : (v ?? undefined) })}
        >
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          {error ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-red-700 dark:text-red-300">{parseApiError(error).message}</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : !isLoading && data?.courses.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <BookOpen className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {urlQuery || status ? 'No courses match these filters.' : 'No courses yet. Instructors create them.'}
              </p>
            </div>
          ) : (
            <Table
              className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}
              aria-busy={isFetching}
            >
              <TableCaption className="sr-only">Courses, newest first</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Course</TableHead>
                  <TableHead className="hidden md:table-cell">Instructor</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-px pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-4" colSpan={5}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : data?.courses.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="pl-4 whitespace-normal">
                          <div className="flex flex-wrap items-center gap-1.5 font-medium">
                            <Link to={`/admin/courses/${course.id}`} className="hover:underline">
                              {course.title}
                            </Link>
                            {course.code && <Badge variant="secondary">{course.code}</Badge>}
                            {course.status === 'archived' && (
                              <Badge variant="outline">{course.archivedByAdmin ? 'Archived by admin' : 'Archived'}</Badge>
                            )}
                          </div>
                          {/* Phones: instructor sits under the title instead of its own column. */}
                          <div className="text-xs text-muted-foreground md:hidden">
                            {course.instructor?.name ?? 'No instructor'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {course.instructor ? (
                            <>
                              <div>{course.instructor.name}</div>
                              <div className="text-xs text-muted-foreground">{course.instructor.email}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">No instructor</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{course.studentCount}</TableCell>
                        <TableCell className="hidden lg:table-cell">{formatDate(course.createdAt)}</TableCell>
                        <TableCell className="pr-4 text-right">
                          <CourseActions course={course} />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={(next) => updateParams({ page: String(next) })}
        />
      )}
    </div>
  )
}

function CourseActions({ course }: { course: AdminCourse }) {
  const [confirm, setConfirm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [setStatus, { isLoading }] = useSetAnyCourseStatusMutation()

  const change = async (status: 'active' | 'archived') => {
    try {
      toast.success((await setStatus({ id: course.id, status }).unwrap()).message)
      setConfirm(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label={`Actions for ${course.title}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {course.status === 'active' ? (
            <DropdownMenuItem onClick={() => setConfirm(true)}>
              <Archive aria-hidden="true" />
              Archive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => void change('active')}>
              <ArchiveRestore aria-hidden="true" />
              Restore
            </DropdownMenuItem>
          )}
          {course.canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteCourseDialog course={course} open={confirmDelete} onOpenChange={setConfirmDelete} />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {course.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {course.studentCount} {course.studentCount === 1 ? 'student' : 'students'} will no longer see it,
              and nobody can join. Nothing is deleted. Only an admin can restore it; its instructor can't.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton
              type="button"
              className="sm:w-auto"
              loading={isLoading}
              loadingText="Archiving…"
              onClick={() => void change('archived')}
            >
              Archive
            </SubmitButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
