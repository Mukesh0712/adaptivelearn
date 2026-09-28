import { Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/app/hooks'
import { Button } from '@/components/ui/button'
import { useLogoutMutation } from '@/features/auth/authApi'
import { ROLE_LABEL } from '@/lib/roles'

// TEMPORARY layout so the routing can be tested now. It will be replaced by
// the shadcn sidebar + navbar shell once those components are added.
export function AppLayout() {
  const { user } = useAuth()
  const [logout, { isLoading }] = useLogoutMutation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">AdaptiveLearn</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {user?.name} · {user ? ROLE_LABEL[user.role] : ''}
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoading}>
            Log out
          </Button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
