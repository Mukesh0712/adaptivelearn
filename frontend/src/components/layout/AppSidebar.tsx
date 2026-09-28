import { GraduationCap } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { useAuth } from '@/app/hooks'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { ROLE_HOME, ROLE_LABEL } from '@/lib/roles'
import { SiteFooterLinks } from '@/components/SiteFooterLinks'
import { NAV_ITEMS } from './nav'

export function AppSidebar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!user) return null

  return (
    // collapsible="icon": on desktop the sidebar shrinks to icons; on mobile
    // it becomes a slide-in drawer (handled by the shadcn component).
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<NavLink to={ROLE_HOME[user.role]} />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <GraduationCap className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">AdaptiveLearn</span>
                <span className="truncate text-xs text-muted-foreground">
                  {ROLE_LABEL[user.role]} portal
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS[user.role].map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    render={<NavLink to={item.to} />}
                    isActive={pathname === item.to}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <SiteFooterLinks className="px-2" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
