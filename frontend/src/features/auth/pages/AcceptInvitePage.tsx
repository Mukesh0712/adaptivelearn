import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { PasswordInput } from '@/components/PasswordInput'
import { SubmitButton } from '@/components/SubmitButton'
import { Label } from '@/components/ui/label'
import { ROLE_LABEL } from '@/lib/roles'
import { parseApiError } from '../apiError'
import { useAcceptInviteMutation, useLogoutMutation, useVerifyInviteQuery } from '../authApi'
import { acceptInviteSchema } from '../schemas'
import { useAuthForm } from '../useAuthForm'
import { AuthCard, FieldError, FormError } from './AuthCard'

const TOKEN_PATTERN = /^[a-f0-9]{64}$/

// Opened from an Admin's invite email: /accept-invite?token=<64 hex chars>.
// Checks the link first, then lets the invited person choose a password.
export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const validFormat = TOKEN_PATTERN.test(token)
  const { data: invite, error, isLoading } = useVerifyInviteQuery(token, { skip: !validFormat })

  if (!validFormat || error) {
    return (
      <AuthCard title="Invite link not valid" description="It may have expired, been used already, or been altered">
        <PageMeta title="Invite link not valid" />
        <FormError
          message={
            error
              ? parseApiError(error).message
              : 'This invite link is incomplete. Please open it again from the email.'
          }
        />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already activated your account?{' '}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </p>
      </AuthCard>
    )
  }

  if (isLoading || !invite) {
    return (
      <AuthCard title="Checking your invite…" description="One moment">
        <PageMeta title="Accept invite" />
        <LoaderCircle className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </AuthCard>
    )
  }

  return <AcceptInviteForm token={token} name={invite.name} email={invite.email} roleLabel={ROLE_LABEL[invite.role]} />
}

function AcceptInviteForm({
  token,
  name,
  email,
  roleLabel,
}: {
  token: string
  name: string
  email: string
  roleLabel: string
}) {
  const navigate = useNavigate()
  const auth = useAuth()
  const [acceptInvite, { isLoading }] = useAcceptInviteMutation()
  const [logout] = useLogoutMutation()
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } = useAuthForm(
    acceptInviteSchema,
    { password: '', confirmPassword: '', acceptTerms: false },
  )

  // Someone else (e.g. the admin who sent the invite, testing the link) may
  // be logged in on this browser. They're logged out first, otherwise the
  // login page would just send them back to their own portal.
  const signedInAs = auth.status === 'authenticated' ? auth.user : null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      const res = await acceptInvite({ token, password: values.password, acceptTerms: values.acceptTerms }).unwrap()
      if (signedInAs) await logout().unwrap().catch(() => undefined)
      toast.success(res.message)
      navigate('/login', { replace: true, state: { email: res.email } })
    } catch (err) {
      handleServerError(err)
    }
  }

  return (
    <AuthCard title={`Welcome, ${name}`} description={`You've been invited to join as ${roleLabel}`}>
      <PageMeta title="Accept invite" description="Activate your AdaptiveLearn account." />
      <form onSubmit={handleSubmit} method="post" className="grid gap-4" noValidate>
        {signedInAs && (
          <p role="note" className="rounded-lg border bg-muted px-3 py-2 text-sm">
            You're logged in as {signedInAs.email}. Activating this account will log you out.
          </p>
        )}
        <FormError message={formError} />

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          {/* Shown read-only (and as a username field, so password managers
              save the new password under the right account). */}
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            readOnly
            value={email}
            className="h-8 rounded-lg border border-input bg-muted px-2.5 text-sm text-muted-foreground"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Choose a password</Label>
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

        <SubmitButton loading={isLoading} loadingText="Activating account…">
          Activate {roleLabel} account
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
