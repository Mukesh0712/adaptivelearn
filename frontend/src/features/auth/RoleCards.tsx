import { GraduationCap, Info, Users, type LucideIcon } from 'lucide-react'
import { ROLE_LABEL, SELF_REGISTER_ROLES, type SelfRegisterRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

const ROLE_ICON: Record<SelfRegisterRole, LucideIcon> = {
  student: GraduationCap,
  parent: Users,
}

// Role picker for the register page: two compact options side by side.
// They are real radio buttons, so arrow keys and screen readers work like any
// radio group. Nothing is pre-selected, so the user has to choose.
export function RoleCards({
  value,
  onChange,
  error,
}: {
  value: SelfRegisterRole | ''
  onChange: (role: SelfRegisterRole) => void
  error?: string
}) {
  return (
    <fieldset
      className="grid gap-2"
      aria-describedby={error ? 'role-error role-note' : 'role-note'}
      aria-invalid={!!error}
    >
      <legend className="mb-2 text-sm font-medium">I am a…</legend>

      <div className="grid grid-cols-2 gap-2">
        {SELF_REGISTER_ROLES.map((role, i) => {
          const Icon = ROLE_ICON[role]
          return (
            <label
              key={role}
              className={cn(
                'flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
                'hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-muted has-[:checked]:font-medium has-[:checked]:ring-1 has-[:checked]:ring-primary',
                'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                error && 'border-destructive',
              )}
            >
              <input
                // The first radio carries the field id, so "focus the first
                // invalid field" lands here when no role is chosen.
                id={i === 0 ? 'role' : undefined}
                type="radio"
                name="role"
                value={role}
                checked={value === role}
                onChange={() => onChange(role)}
                className="size-4 shrink-0 accent-primary"
              />
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {ROLE_LABEL[role]}
            </label>
          )
        })}
      </div>

      {error && (
        <p id="role-error" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <p id="role-note" className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>Can&apos;t be changed later · Instructors are invited by an admin</span>
      </p>
    </fieldset>
  )
}
