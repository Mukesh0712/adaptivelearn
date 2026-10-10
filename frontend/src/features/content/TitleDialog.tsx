import { useState, type FormEvent } from 'react'
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

interface TitleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  heading: string
  description: string
  label: string
  submitText: string
  maxLength: number
  initial?: string
  // Saves the title. Throwing shows the server's message under the field.
  onSubmit: (title: string) => Promise<unknown>
}

// One small dialog with a single "title" field, used for adding a module,
// renaming a module and adding a lesson.
export function TitleDialog(props: TitleDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so the field starts fresh every time. */}
        {props.open && <TitleForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function TitleForm({ heading, description, label, submitText, maxLength, initial = '', onSubmit, onOpenChange }: TitleDialogProps) {
  const [title, setTitle] = useState(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const value = title.trim()
    if (value.length < 2) {
      setError('Title must be at least 2 characters')
      return
    }
    setSaving(true)
    try {
      await onSubmit(value)
      onOpenChange(false)
    } catch (err) {
      setError(parseApiError(err).message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="content-title">{label}</Label>
        <Input
          id="content-title"
          value={title}
          maxLength={maxLength}
          autoFocus
          aria-invalid={!!error}
          aria-describedby={error ? 'content-title-error' : undefined}
          onChange={(e) => {
            setTitle(e.target.value)
            setError('')
          }}
        />
        <FieldError id="content-title-error" message={error} />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <SubmitButton loading={saving} loadingText="Saving…" className="sm:w-auto">
          {submitText}
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
