import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { MailCheck } from 'lucide-react'
import { Honeypot } from '@/components/Honeypot'
import { SubmitButton } from '@/components/SubmitButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useForgotPasswordMutation } from '../authApi'
import { forgotPasswordSchema } from '../schemas'
import { useAuthForm } from '../useAuthForm'
import { AuthCard, FieldError, FormError } from './AuthCard'
import { PageMeta } from '@/components/PageMeta'

export default function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation()
  const [sentTo, setSentTo] = useState('')
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } =
    useAuthForm(forgotPasswordSchema, { email: '', website: '' })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      await forgotPassword({ email: values.email, website: values.website }).unwrap()
      setSentTo(values.email)
    } catch (err) {
      handleServerError(err)
    }
  }

  if (sentTo) {
    // Same message whether or not the account exists (the backend never
    // reveals which emails are registered).
    return (
      <AuthCard title="Check your email" description="Follow the link to choose a new password">
        <PageMeta title="Check your email" />
        <div className="grid gap-4 text-sm">
          <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <MailCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <p>
              If an account exists for <span className="font-medium">{sentTo}</span>, we&apos;ve sent a
              link to reset your password. It expires in 30 minutes.
            </p>
          </div>
          <p className="text-muted-foreground">
            Didn&apos;t get it? Check your spam folder, or{' '}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-4"
              onClick={() => setSentTo('')}
            >
              try again
            </button>
            .
          </p>
          <Link to="/login" className="text-center font-medium underline underline-offset-4">
            Back to log in
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Forgot your password?" description="Enter your email and we'll send you a reset link">
      <PageMeta title="Forgot password" description="Reset your AdaptiveLearn password by email." />
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <FormError message={formError} />

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            {...fieldProps('email')}
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <Honeypot value={values.website} onChange={(v) => setField('website', v)} />

        <SubmitButton loading={isLoading} loadingText="Sending link…">
          Send reset link
        </SubmitButton>

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Back to log in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}
