import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PasswordInput } from '@/components/PasswordInput'
import { SubmitButton } from '@/components/SubmitButton'
import { Label } from '@/components/ui/label'
import { useResetPasswordMutation } from '../authApi'
import { resetPasswordSchema } from '../schemas'
import { useAuthForm } from '../useAuthForm'
import { AuthCard, FieldError, FormError } from './AuthCard'

// Opened from the emailed link: /reset-password?token=<64 hex chars>
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [resetPassword, { isLoading }] = useResetPasswordMutation()
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } =
    useAuthForm(resetPasswordSchema, { password: '', confirmPassword: '' })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      const { message } = await resetPassword({ token, password: values.password }).unwrap()
      toast.success(message)
      navigate('/login', { replace: true })
    } catch (err) {
      handleServerError(err)
    }
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthCard title="Invalid reset link" description="This link is incomplete or has been altered">
        <title>Invalid link · AdaptiveLearn</title>
        <Link to="/forgot-password" className="block text-center text-sm font-medium underline underline-offset-4">
          Request a new reset link
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Choose a new password" description="You'll be logged out of all other devices">
      <title>Reset password · AdaptiveLearn</title>
      <form onSubmit={handleSubmit} method="post" className="grid gap-4" noValidate>
        <FormError message={formError} />
        {formError && (
          <Link to="/forgot-password" className="-mt-2 text-sm font-medium underline underline-offset-4">
            Request a new reset link
          </Link>
        )}

        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            {...fieldProps('password')}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            name="password"
            autoComplete="new-password"
            autoFocus
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
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput
            {...fieldProps('confirmPassword')}
            name="confirmPassword"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => setField('confirmPassword', e.target.value)}
          />
          <FieldError id="confirmPassword-error" message={errors.confirmPassword} />
        </div>

        <SubmitButton loading={isLoading} loadingText="Updating password…">
          Update password
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
