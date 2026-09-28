import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLoginMutation } from '../authApi'
import { parseApiError } from '../apiError'
import { AuthCard, FieldError, FormError } from './AuthCard'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, { isLoading, error }] = useLoginMutation()
  const { message, fields } = parseApiError(error)

  // On success the auth state becomes "authenticated", and GuestRoute
  // redirects to the right portal automatically.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void login({ email, password })
  }

  return (
    <AuthCard title="Welcome back" description="Log in to your AdaptiveLearn account">
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <FormError message={fields.email || fields.password ? '' : message} />

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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fields.password}
            aria-describedby={fields.password ? 'password-error' : undefined}
            required
          />
          <FieldError id="password-error" message={fields.password} />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Logging in…' : 'Log in'}
        </Button>

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
