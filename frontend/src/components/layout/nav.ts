import { LayoutDashboard, type LucideIcon } from 'lucide-react'
import { ROLE_HOME, type Role } from '@/lib/roles'

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
}

// Sidebar links per role. Only the dashboard exists in Phase 1; each new
// feature adds its page here for the roles that may use it.
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  student: [{ title: 'Dashboard', to: ROLE_HOME.student, icon: LayoutDashboard }],
  instructor: [{ title: 'Dashboard', to: ROLE_HOME.instructor, icon: LayoutDashboard }],
  parent: [{ title: 'Dashboard', to: ROLE_HOME.parent, icon: LayoutDashboard }],
  admin: [{ title: 'Dashboard', to: ROLE_HOME.admin, icon: LayoutDashboard }],
}
