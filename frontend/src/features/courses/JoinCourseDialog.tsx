import { useState, type FormEvent } from 'react'
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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/features/auth/pages/AuthCard'
import { parseApiError } from '@/features/auth/apiError'
import { useJoinCourseMutation } from './coursesApi'

// Turns whatever is typed ("k7q2mx", "K7Q 2MX") into the display form "K7Q-2MX".
const tidy = (input: string) => {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw
}

export function JoinCourseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open && <JoinForm onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function JoinForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [join, { isLoading }] = useJoinCourseMutation()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.replace('-', '').length !== 6) {
      setError('A join code has 6 letters and numbers, like K7Q-2MX')
      document.getElementById('join-code')?.focus()
      return
    }
    try {
      toast.success((await join(code).unwrap()).message)
      onDone()
    } catch (err) {
      setError(parseApiError(err).message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Join a course</DialogTitle>
        <DialogDescription>Enter the 6-character code your instructor shared.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="join-code">Join code</Label>
        <Input
          id="join-code"
          name="code"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="K7Q-2MX"
          value={code}
          onChange={(e) => {
            setCode(tidy(e.target.value))
            setError('')
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'join-code-error' : undefined}
          className="h-11 text-center font-mono text-xl tracking-widest uppercase md:text-xl"
        />
        <FieldError id="join-code-error" message={error} />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton loading={isLoading} loadingText="Joining…" className="sm:w-auto">
          Join course
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
