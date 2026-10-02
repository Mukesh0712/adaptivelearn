import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/app/hooks'
import { PageMeta } from '@/components/PageMeta'
import { PasswordInput } from '@/components/PasswordInput'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RoleBadge } from '@/features/admin/UserBadges'
import { FieldError, FormError } from '@/features/auth/pages/AuthCard'
import { changePasswordSchema, profileSchema } from '@/features/auth/schemas'
import { useAuthForm } from '@/features/auth/useAuthForm'
import { formatDate } from '@/lib/dates'
import { useChangePasswordMutation, useUpdateProfileMutation } from './profileApi'

// Every role's own account: name, and password change.
export default function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="max-w-2xl space-y-6">
      <PageMeta title="Profile" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Your account details and password.</p>
      </div>
      {/* key: a fresh form if the name changes elsewhere */}
      <DetailsCard key={user.name} />
      <PasswordCard />
    </div>
  )
}

function DetailsCard() {
  const { user } = useAuth()
  const [updateProfile, { isLoading }] = useUpdateProfileMutation()
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } = useAuthForm(profileSchema, {
    name: user?.name ?? '',
  })
  if (!user) return null
  const unchanged = values.name.trim() === user.name

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (unchanged || !validate()) return
    try {
      toast.success((await updateProfile({ name: values.name.trim() }).unwrap()).message)
    } catch (err) {
      handleServerError(err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your details</CardTitle>
        <CardDescription>
          Member since {formatDate(user.createdAt)}. To change your email, contact an administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FormError message={formError} />
          <div className="grid gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              {...fieldProps('name')}
              name="name"
              autoComplete="name"
              maxLength={100}
              value={values.name}
              onChange={(e) => setField('name', e.target.value)}
            />
            <FieldError id="name-error" message={errors.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user.email} readOnly className="bg-muted text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Role:</span>
            <RoleBadge role={user.role} />
          </div>
          <SubmitButton loading={isLoading} loadingText="Saving…" className="sm:w-fit" disabled={unchanged || isLoading}>
            Save changes
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}

// The API calls the new password "newPassword"; this form's field is
// "password" (so the shared "passwords match" check works). Rename the
// server's field error so it shows under the right input.
function renameField(err: unknown, from: string, to: string): unknown {
  const e = err as { data?: { details?: Record<string, string[]> } }
  const details = e?.data?.details
  if (!details?.[from]) return err
  const { [from]: moved, ...rest } = details
  return { ...e, data: { ...e.data, details: { ...rest, [to]: moved } } }
}

function PasswordCard() {
  const { user } = useAuth()
  const [changePassword, { isLoading }] = useChangePasswordMutation()
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } = useAuthForm(
    changePasswordSchema,
    { currentPassword: '', password: '', confirmPassword: '' },
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      const res = await changePassword({ currentPassword: values.currentPassword, newPassword: values.password }).unwrap()
      toast.success(res.message)
      setField('currentPassword', '')
      setField('password', '')
      setField('confirmPassword', '')
    } catch (err) {
      handleServerError(renameField(err, 'newPassword', 'password'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>You'll stay logged in here; every other device is logged out.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} method="post" className="grid gap-4" noValidate>
          <FormError message={formError} />
          {/* Lets password managers update the saved password for this account. */}
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <PasswordInput
              {...fieldProps('currentPassword')}
              name="currentPassword"
              autoComplete="current-password"
              value={values.currentPassword}
              onChange={(e) => setField('currentPassword', e.target.value)}
            />
            <FieldError id="currentPassword-error" message={errors.currentPassword} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
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
          <SubmitButton loading={isLoading} loadingText="Changing password…" className="sm:w-fit">
            Change password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
