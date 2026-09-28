import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Honeypot } from '@/components/Honeypot'
import { toast } from 'sonner'
import { PasswordInput } from '@/components/PasswordInput'
import { SubmitButton } from '@/components/SubmitButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROLE_LABEL, SELF_REGISTER_ROLES } from '@/lib/roles'
import { useRegisterMutation } from '../authApi'
import { registerSchema } from '../schemas'
import type { RegisterRequest } from '../types'
import { useAuthForm } from '../useAuthForm'
import { AuthCard, FieldError, FormError } from './AuthCard'
import { PageMeta } from '@/components/PageMeta'

type SelfRole = RegisterRequest['role']

// value → label map, so the Select shows "Student" rather than "student".
const roleItems = Object.fromEntries(SELF_REGISTER_ROLES.map((r) => [r, ROLE_LABEL[r]]))

export default function RegisterPage() {
  const [register, { isLoading }] = useRegisterMutation()
  const navigate = useNavigate()
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } =
    useAuthForm(registerSchema, {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'student' as SelfRole,
      acceptTerms: false,
      website: '',
    })

  // Admin is intentionally not offered: the backend rejects it anyway, and
  // admins are created with the seed script. On success the user is sent to
  // the login page with their email already filled in.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      // confirmPassword is only checked in the browser; it isn't sent.
      const { name, email, password, role, acceptTerms, website } = values
      const { message } = await register({ name, email, password, role, acceptTerms, website }).unwrap()
      toast.success(message)
      navigate('/login', { replace: true, state: { email } })
    } catch (err) {
      handleServerError(err)
    }
  }

  return (
    <AuthCard title="Create an account" description="Choose your role to get the right portal">
      <PageMeta title="Create an account" description="Create your free AdaptiveLearn account as a student, instructor or parent." />
      <form onSubmit={handleSubmit} method="post" className="grid gap-4" noValidate>
        <FormError message={formError} />

        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            {...fieldProps('name')}
            name="name"
            autoComplete="name"
            autoFocus
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
          />
          <FieldError id="name-error" message={errors.name} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            {...fieldProps('email')}
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            {...fieldProps('password')}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            name="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => setField('password', e.target.value)}
          />
          {errors.password ? (
            <FieldError id="password-error" message={errors.password} />
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            {...fieldProps('confirmPassword')}
            name="confirmPassword"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => setField('confirmPassword', e.target.value)}
          />
          <FieldError id="confirmPassword-error" message={errors.confirmPassword} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="role">I am a</Label>
          <Select
            items={roleItems}
            value={values.role}
            onValueChange={(value) => value && setField('role', value as SelfRole)}
          >
            <SelectTrigger id="role" className="w-full" aria-invalid={!!errors.role}>
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
          <FieldError id="role-error" message={errors.role} />
        </div>

        <div className="grid gap-2">
          <div className="flex items-start gap-2">
            <input
              {...fieldProps('acceptTerms')}
              name="acceptTerms"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              checked={values.acceptTerms}
              onChange={(e) => setField('acceptTerms', e.target.checked)}
            />
            <Label htmlFor="acceptTerms" className="block leading-snug font-normal">
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="font-medium underline underline-offset-4">
                Terms &amp; Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="font-medium underline underline-offset-4">
                Privacy Policy
              </Link>
            </Label>
          </div>
          <FieldError id="acceptTerms-error" message={errors.acceptTerms} />
        </div>

        <Honeypot value={values.website} onChange={(v) => setField('website', v)} />

        <SubmitButton loading={isLoading} loadingText="Creating account…">
          Create account
        </SubmitButton>

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
