import { GraduationCap, Info, Users, type LucideIcon } from 'lucide-react'
import { SITE } from '@/config/site'
import { ROLE_LABEL, SELF_REGISTER_ROLES, type SelfRegisterRole } from '@/lib/roles'
import { cn } from '@/lib/utils'

const ROLE_INFO: Record<SelfRegisterRole, { icon: LucideIcon; description: string }> = {
  student: { icon: GraduationCap, description: "I'm here to learn" },
  parent: { icon: Users, description: "I'm following my child's progress" },
}

// Role picker for the register page. Real radio buttons styled as cards:
// both choices are visible at once, and keyboard (arrow keys) and screen
// readers work like any radio group. Nothing is pre-selected, so the user
// has to make a conscious choice.
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
          const { icon: Icon, description } = ROLE_INFO[role]
          return (
            <label
              key={role}
              className={cn(
                'relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors',
                'hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-muted has-[:checked]:ring-1 has-[:checked]:ring-primary',
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
                className="absolute top-3 right-3 size-4 accent-primary"
              />
              <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{ROLE_LABEL[role]}</span>
              <span className="pr-4 text-xs text-muted-foreground">{description}</span>
            </label>
          )
        })}
      </div>

      {error && (
        <p id="role-error" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div id="role-note" className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-700" aria-hidden="true" />
        <div className="grid gap-1">
          <p>
            Your role can&apos;t be changed after you create your account. If you choose the wrong one, contact an
            admin at{' '}
            <a className="font-medium underline underline-offset-2" href={`mailto:${SITE.contactEmail}`}>
              {SITE.contactEmail}
            </a>
            .
          </p>
          <p>Are you an instructor? Your admin will send you an invite by email.</p>
        </div>
      </div>
    </fieldset>
  )
}
