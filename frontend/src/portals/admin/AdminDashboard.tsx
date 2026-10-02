import { Link } from 'react-router'
import { ArrowRight, BookOpen, GraduationCap, HeartHandshake, UsersRound } from 'lucide-react'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { StatCard } from '@/components/StatCard'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PendingBanner } from '@/features/admin/PendingBanner'
import { RecentActivity } from '@/features/admin/RecentActivity'
import { useAdminDashboardQuery } from '@/features/dashboard/dashboardApi'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { data, isLoading } = useAdminDashboardQuery()
  const s = data?.stats

  return (
    <div className="space-y-6">
      <PageMeta title="Admin dashboard" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.name}.</p>
      </div>

      <PendingBanner />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={s?.students} icon={GraduationCap} hint="Active accounts" loading={isLoading} />
        <StatCard
          label="Instructors"
          value={s?.instructors}
          icon={UsersRound}
          hint={s?.invited ? `${s.invited} invite${s.invited === 1 ? '' : 's'} not accepted yet` : 'Active accounts'}
          loading={isLoading}
        />
        <StatCard label="Parents" value={s?.parents} icon={HeartHandshake} hint="Active accounts" loading={isLoading} />
        <StatCard
          label="Courses"
          value={s?.activeCourses}
          icon={BookOpen}
          hint={`${s?.enrollments ?? 0} enrolments · ${s?.archivedCourses ?? 0} archived`}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="grid content-start gap-4">
          {[
            { to: '/admin/users', title: 'Users', text: 'Approve sign-ups, invite people, manage accounts.' },
            { to: '/admin/courses', title: 'Courses', text: 'Open, create, reassign or archive courses.' },
          ].map((link) => (
            <Card key={link.to}>
              <CardHeader>
                <CardTitle>{link.title}</CardTitle>
                <CardDescription>{link.text}</CardDescription>
                <Link to={link.to} className={buttonVariants({ variant: 'outline', className: 'mt-2 w-fit' })}>
                  Open {link.title.toLowerCase()}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </CardHeader>
            </Card>
          ))}
        </div>
        <RecentActivity />
      </div>
    </div>
  )
}
