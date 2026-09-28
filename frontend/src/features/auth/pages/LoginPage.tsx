import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { PasswordInput } from '@/components/PasswordInput'
import { SubmitButton } from '@/components/SubmitButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLoginMutation } from '../authApi'
import { loginSchema } from '../schemas'
import { useAuthForm } from '../useAuthForm'
import { AuthCard, FieldError, FormError } from './AuthCard'
import { PageMeta } from '@/components/PageMeta'

export default function LoginPage() {
  const [login, { isLoading }] = useLoginMutation()
  // Coming from the register page: the new account's email is pre-filled.
  const prefilledEmail = (useLocation().state as { email?: string } | null)?.email ?? ''
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } =
    useAuthForm(loginSchema, { email: prefilledEmail, password: '', rememberMe: false })

  // On success the auth state becomes "authenticated", and GuestRoute
  // redirects to the right portal automatically.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      const { user } = await login(values).unwrap()
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
    } catch (err) {
      handleServerError(err)
    }
  }

  return (
    <AuthCard title="Welcome back" description="Log in to your AdaptiveLearn account">
      <PageMeta title="Log in" description="Log in to AdaptiveLearn: your smart classroom for students, instructors, parents and administrators." />
      {/* method="post" + name/autoComplete attributes let the browser's
          password manager offer to save and later autofill the password. */}
      <form onSubmit={handleSubmit} method="post" className="grid gap-4" noValidate>
        <FormError message={formError} />

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            {...fieldProps('email')}
            name="email"
            type="email"
            autoComplete="username"
            autoFocus={!prefilledEmail}
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="inline-flex min-h-6 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            {...fieldProps('password')}
            name="password"
            autoComplete="current-password"
            autoFocus={!!prefilledEmail}
            value={values.password}
            onChange={(e) => setField('password', e.target.value)}
          />
          <FieldError id="password-error" message={errors.password} />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            name="rememberMe"
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            checked={values.rememberMe}
            onChange={(e) => setField('rememberMe', e.target.checked)}
          />
          <Label htmlFor="rememberMe" className="font-normal">
            Remember me for 30 days
          </Label>
        </div>

        <SubmitButton loading={isLoading} loadingText="Logging in…">
          Log in
        </SubmitButton>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-foreground underline underline-offset-4">
            Register
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
