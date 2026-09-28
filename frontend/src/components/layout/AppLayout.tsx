import { Outlet } from 'react-router'
import { useAuth } from '@/app/hooks'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ROLE_LABEL } from '@/lib/roles'
import { AppSidebar } from './AppSidebar'
import { UserMenu } from './UserMenu'

// Shell shared by all four portals: sidebar on the left, navbar on top,
// and the current page (<Outlet />) in the main area.
export function AppLayout() {
  const { user } = useAuth()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-center" />
          <span className="text-sm font-medium">
            {user ? `${ROLE_LABEL[user.role]} portal` : ''}
          </span>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
