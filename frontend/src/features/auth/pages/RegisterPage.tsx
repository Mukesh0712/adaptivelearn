import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROLE_LABEL, SELF_REGISTER_ROLES } from '@/lib/roles'
import { useRegisterMutation } from '../authApi'
import { parseApiError } from '../apiError'
import type { RegisterRequest } from '../types'
import { AuthCard, FieldError, FormError } from './AuthCard'

type SelfRole = RegisterRequest['role']

// value → label map, so the Select shows "Student" rather than "student".
const roleItems = Object.fromEntries(SELF_REGISTER_ROLES.map((r) => [r, ROLE_LABEL[r]]))

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<SelfRole>('student')
  const [register, { isLoading, error }] = useRegisterMutation()
  const { message, fields } = parseApiError(error)
  const hasFieldErrors = Object.keys(fields).length > 0

  // Admin is intentionally not offered: the backend rejects it anyway, and
  // admins are created with the seed script. On success GuestRoute sends
  // the new user straight to their portal.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void register({ name, email, password, role })
  }

  return (
    <AuthCard title="Create an account" description="Choose your role to get the right portal">
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <FormError message={hasFieldErrors ? '' : message} />

        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!fields.name}
            aria-describedby={fields.name ? 'name-error' : undefined}
            required
          />
          <FieldError id="name-error" message={fields.name} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fields.email}
            aria-describedby={fields.email ? 'email-error' : undefined}
            required
          />
          <FieldError id="email-error" message={fields.email} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fields.password}
            aria-describedby={fields.password ? 'password-error' : 'password-hint'}
            required
          />
          {fields.password ? (
            <FieldError id="password-error" message={fields.password} />
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="role">I am a</Label>
          <Select
            items={roleItems}
            value={role}
            onValueChange={(value) => value && setRole(value as SelfRole)}
          >
            <SelectTrigger id="role" className="w-full" aria-invalid={!!fields.role}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELF_REGISTER_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="role-error" message={fields.role} />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
