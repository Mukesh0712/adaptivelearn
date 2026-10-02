import { useRef, useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, Copy, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { SubmitButton } from '@/components/SubmitButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormError } from '@/features/auth/pages/AuthCard'
import { useAuthForm } from '@/features/auth/useAuthForm'
import { useInviteUserMutation } from './adminApi'
import { inviteSchema } from './schemas'
import type { InviteResponse } from './types'

// "Invite instructor" button + dialog on the Admin Users page.
// Step 1: name + email. Step 2: result, with the invite link to copy.
export function InviteDialog() {
  const [open, setOpen] = useState(false)
  // A new key each time the dialog opens gives a fresh, empty form.
  const [formKey, setFormKey] = useState(0)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setFormKey((k) => k + 1)
        setOpen(next)
      }}
    >
      <DialogTrigger render={<Button />}>
        <UserPlus aria-hidden="true" />
        Invite instructor
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <InviteFlow key={formKey} onInviteAnother={() => setFormKey((k) => k + 1)} />
      </DialogContent>
    </Dialog>
  )
}

function InviteFlow({ onInviteAnother }: { onInviteAnother: () => void }) {
  const [invite, { isLoading }] = useInviteUserMutation()
  const [result, setResult] = useState<InviteResponse | null>(null)
  const { values, setField, errors, formError, validate, handleServerError, fieldProps } = useAuthForm(
    inviteSchema,
    { name: '', email: '' },
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      setResult(await invite({ name: values.name.trim(), email: values.email.trim(), role: 'instructor' }).unwrap())
    } catch (err) {
      handleServerError(err)
    }
  }

  if (result) return <InviteResult result={result} onInviteAnother={onInviteAnother} />

  return (
    <form onSubmit={handleSubmit} method="post" className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Invite an instructor</DialogTitle>
        <DialogDescription>
          They'll get an email with a link to set their password. Instructor accounts can only be created this
          way.
        </DialogDescription>
      </DialogHeader>

      <FormError message={formError} />

      <div className="grid gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          {...fieldProps('name')}
          name="name"
          autoComplete="off"
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
          autoComplete="off"
          value={values.email}
          onChange={(e) => setField('email', e.target.value)}
        />
        <FieldError id="email-error" message={errors.email} />
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton loading={isLoading} loadingText="Sending invite…" className="sm:w-auto">
          Send invite
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}

const expiryFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

function InviteResult({ result, onInviteAnother }: { result: InviteResponse; onInviteAnother: () => void }) {
  const linkRef = useRef<HTMLInputElement>(null)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.inviteLink)
      toast.success('Invite link copied')
    } catch {
      // Clipboard can be blocked (e.g. plain http); select the text instead
      // so the admin can press Ctrl+C.
      linkRef.current?.select()
      toast.info('Press Ctrl+C to copy the selected link')
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {result.emailSent ? (
            <CircleCheck className="size-5 text-emerald-600" aria-hidden="true" />
          ) : (
            <CircleAlert className="size-5 text-amber-600" aria-hidden="true" />
          )}
          {result.emailSent ? 'Invite sent' : 'Invite created, email not sent'}
        </DialogTitle>
        <DialogDescription role="status">{result.message}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="invite-link">Invite link</Label>
        <div className="flex gap-2">
          <Input
            ref={linkRef}
            id="invite-link"
            readOnly
            value={result.inviteLink}
            onFocus={(e) => e.target.select()}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant={result.emailSent ? 'outline' : 'default'}
            onClick={() => void copyLink()}
          >
            <Copy aria-hidden="true" />
            Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Single use · expires {expiryFormat.format(new Date(result.expiresAt))}. Only share it with{' '}
          {result.user.name}.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onInviteAnother}>
          Invite another
        </Button>
        <DialogClose render={<Button type="button" />}>Done</DialogClose>
      </DialogFooter>
    </div>
  )
}
