import { BookOpen, History, LayoutDashboard, UsersRound, type LucideIcon } from 'lucide-react'
import { ROLE_HOME, type Role } from '@/lib/roles'

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
}

// Sidebar links per role. Each new feature adds its page here for the roles
// that may use it.
export const NAV_ITEMS: Record<Role, NavItem[]> = {
  student: [
    { title: 'Dashboard', to: ROLE_HOME.student, icon: LayoutDashboard },
    { title: 'My courses', to: `${ROLE_HOME.student}/courses`, icon: BookOpen },
  ],
  instructor: [
    { title: 'Dashboard', to: ROLE_HOME.instructor, icon: LayoutDashboard },
    { title: 'My courses', to: `${ROLE_HOME.instructor}/courses`, icon: BookOpen },
  ],
  parent: [{ title: 'Dashboard', to: ROLE_HOME.parent, icon: LayoutDashboard }],
  admin: [
    { title: 'Dashboard', to: ROLE_HOME.admin, icon: LayoutDashboard },
    { title: 'Users', to: `${ROLE_HOME.admin}/users`, icon: UsersRound },
    { title: 'Courses', to: `${ROLE_HOME.admin}/courses`, icon: BookOpen },
    { title: 'Activity', to: `${ROLE_HOME.admin}/activity`, icon: History },
  ],
}
