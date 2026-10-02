import { useState, type FormEvent } from 'react'
import { Ban, CircleCheck, Eraser, Info, MailPlus, MoreHorizontal, RotateCcw, UserCog, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { SubmitButton } from '@/components/SubmitButton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/features/auth/pages/AuthCard'
import { parseApiError } from '@/features/auth/apiError'
import type { User } from '@/features/auth/types'
import { ROLE_LABEL } from '@/lib/roles'
import { cn } from '@/lib/utils'
import {
  useApproveUserMutation,
  useChangeRoleMutation,
  useChangeStatusMutation,
  useEraseUserMutation,
  useRejectUserMutation,
  useResendInviteMutation,
} from './adminApi'
import { InviteResult } from './InviteDialog'
import { ASSIGNABLE_ROLES, type AssignableRole, type InviteResponse } from './types'

type OpenDialog = 'role' | 'deactivate' | 'resent' | 'reject' | 'erase' | null

// The "⋯" menu at the end of each row in the Users table. Which actions are
// offered depends on the user's status. (The server enforces the same rules;
// the menu only hides actions that would be refused.)
export function UserActions({ user }: { user: User }) {
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const [resent, setResent] = useState<InviteResponse | null>(null)
  const [resendInvite] = useResendInviteMutation()
  const [changeStatus] = useChangeStatusMutation()
  const [approveUser] = useApproveUserMutation()
  const close = () => setDialog(null)

  const approve = async () => {
    try {
      toast.success((await approveUser(user.id).unwrap()).message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const resend = async () => {
    try {
      setResent(await resendInvite(user.id).unwrap())
      setDialog('resent')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const reactivate = async () => {
    try {
      toast.success((await changeStatus({ id: user.id, status: 'active' }).unwrap()).message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label={`Actions for ${user.name}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {user.status === 'pending' && (
            <>
              <DropdownMenuItem onClick={() => void approve()}>
                <CircleCheck aria-hidden="true" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDialog('reject')}>
                <XCircle aria-hidden="true" />
                Reject
              </DropdownMenuItem>
            </>
          )}
          {user.status === 'invited' && (
            <>
              <DropdownMenuItem onClick={() => void resend()}>
                <MailPlus aria-hidden="true" />
                Resend invite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDialog('deactivate')}>
                <XCircle aria-hidden="true" />
                Cancel invite
              </DropdownMenuItem>
            </>
          )}
          {user.status === 'active' && (
            <>
              <DropdownMenuItem onClick={() => setDialog('role')}>
                <UserCog aria-hidden="true" />
                Change role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDialog('deactivate')}>
                <Ban aria-hidden="true" />
                Deactivate
              </DropdownMenuItem>
            </>
          )}
          {user.status === 'deactivated' && (
            <>
              <DropdownMenuItem onClick={() => void reactivate()}>
                <RotateCcw aria-hidden="true" />
                Reactivate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDialog('erase')}>
                <Eraser aria-hidden="true" />
                Erase personal data
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === 'role'} onOpenChange={(open) => !open && close()}>
        <DialogContent>{dialog === 'role' && <ChangeRoleForm user={user} onDone={close} />}</DialogContent>
      </Dialog>

      <Dialog open={dialog === 'resent'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-md">{resent && <InviteResult result={resent} />}</DialogContent>
      </Dialog>

      <Dialog open={dialog === 'erase'} onOpenChange={(open) => !open && close()}>
        <DialogContent>{dialog === 'erase' && <EraseForm user={user} onDone={close} />}</DialogContent>
      </Dialog>

      <AlertDialog open={dialog === 'reject'} onOpenChange={(open) => !open && close()}>
        <AlertDialogContent>{dialog === 'reject' && <RejectConfirm user={user} onDone={close} />}</AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === 'deactivate'} onOpenChange={(open) => !open && close()}>
        <AlertDialogContent>
          {dialog === 'deactivate' && <DeactivateConfirm user={user} onDone={close} />}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ChangeRoleForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [changeRole, { isLoading }] = useChangeRoleMutation()
  const current = (ASSIGNABLE_ROLES as readonly string[]).includes(user.role) ? (user.role as AssignableRole) : null
  const [role, setRole] = useState<AssignableRole | null>(current)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!role || role === current) return onDone() // nothing changed
    try {
      toast.success((await changeRole({ id: user.id, role }).unwrap()).message)
      onDone()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Change role</DialogTitle>
        <DialogDescription>
          {user.name} · {user.email}
        </DialogDescription>
      </DialogHeader>
      <FormError message={error} />

      <fieldset className="grid gap-2">
        <legend className="sr-only">New role</legend>
        {ASSIGNABLE_ROLES.map((r) => (
          <label
            key={r}
            className={cn(
              'flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors hover:bg-muted',
              'has-[:checked]:border-primary has-[:checked]:bg-muted has-[:checked]:font-medium has-[:checked]:ring-1 has-[:checked]:ring-primary',
              'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
            )}
          >
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              onChange={() => setRole(r)}
              className="size-4 accent-primary"
            />
            {ROLE_LABEL[r]}
            {r === current && <span className="ml-auto text-xs font-normal text-muted-foreground">Current</span>}
          </label>
        ))}
      </fieldset>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>They'll be logged out right away and see the new portal when they log in again.</span>
      </p>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton
          loading={isLoading}
          loadingText="Saving…"
          className="sm:w-auto"
          disabled={isLoading || !role || role === current}
        >
          {role && role !== current ? `Make ${ROLE_LABEL[role]}` : 'Save'}
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}

function DeactivateConfirm({ user, onDone }: { user: User; onDone: () => void }) {
  const [changeStatus, { isLoading }] = useChangeStatusMutation()
  const [error, setError] = useState('')
  const isInvite = user.status === 'invited'

  const confirm = async () => {
    try {
      toast.success((await changeStatus({ id: user.id, status: 'deactivated' }).unwrap()).message)
      onDone()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{isInvite ? `Cancel invite for ${user.name}?` : `Deactivate ${user.name}?`}</AlertDialogTitle>
        <AlertDialogDescription>
          {isInvite
            ? 'The invite link will stop working. You can reactivate them later and send a new invite.'
            : "They'll be logged out immediately and can't log in until you reactivate them. Their data is kept."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <FormError message={error} />
      <AlertDialogFooter>
        <AlertDialogCancel>Keep</AlertDialogCancel>
        <SubmitButton
          type="button"
          variant="destructive"
          className="sm:w-auto"
          loading={isLoading}
          loadingText={isInvite ? 'Cancelling…' : 'Deactivating…'}
          onClick={() => void confirm()}
        >
          {isInvite ? 'Cancel invite' : 'Deactivate'}
        </SubmitButton>
      </AlertDialogFooter>
    </>
  )
}

function RejectConfirm({ user, onDone }: { user: User; onDone: () => void }) {
  const [rejectUser, { isLoading }] = useRejectUserMutation()
  const [error, setError] = useState('')

  const confirm = async () => {
    try {
      toast.success((await rejectUser(user.id).unwrap()).message)
      onDone()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Reject sign-up from {user.name}?</AlertDialogTitle>
        <AlertDialogDescription>
          Their pending account is removed and they can't log in. If this was a mistake, they can register again.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <FormError message={error} />
      <AlertDialogFooter>
        <AlertDialogCancel>Keep</AlertDialogCancel>
        <SubmitButton
          type="button"
          variant="destructive"
          className="sm:w-auto"
          loading={isLoading}
          loadingText="Rejecting…"
          onClick={() => void confirm()}
        >
          Reject
        </SubmitButton>
      </AlertDialogFooter>
    </>
  )
}

// "Right to erasure" (DPDP Act). Typing the person's email is a deliberate
// extra step for something that can't be undone.
function EraseForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [erase, { isLoading }] = useEraseUserMutation()
  const [confirmEmail, setConfirmEmail] = useState('')
  const [error, setError] = useState('')
  const matches = confirmEmail.trim().toLowerCase() === user.email

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!matches) {
      setError("The email doesn't match")
      return
    }
    try {
      toast.success((await erase({ id: user.id, confirmEmail }).unwrap()).message)
      onDone()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Erase personal data of {user.name}?</DialogTitle>
        <DialogDescription>
          Their name and email are removed for good, they're taken out of every course, and they disappear from
          Activity entries. The account stays as an anonymous "Deleted user" so history and counts still add up.
          This can't be undone.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="confirm-email">
          Type <span className="font-mono font-semibold">{user.email}</span> to confirm
        </Label>
        <Input
          id="confirm-email"
          autoComplete="off"
          spellCheck={false}
          value={confirmEmail}
          onChange={(e) => {
            setConfirmEmail(e.target.value)
            setError('')
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'confirm-email-error' : undefined}
        />
        {error && (
          <p id="confirm-email-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton
          variant="destructive"
          className="sm:w-auto"
          loading={isLoading}
          loadingText="Erasing…"
          disabled={!matches || isLoading}
        >
          Erase personal data
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
