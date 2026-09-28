import { useState } from 'react'
import type { z } from 'zod'
import { parseApiError } from './apiError'
import { validateForm, type FieldErrors } from './schemas'

// Shared form logic for the auth pages:
//  - values + setField (editing a field clears that field's error)
//  - instant client-side validation with the zod schema before submitting
//  - server errors mapped onto the same fields (or a form-level message)
export function useAuthForm<T extends Record<string, unknown>>(schema: z.ZodType, initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')

  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key as string]
      return next
    })
    setFormError('')
  }

  // Returns true if the values pass the client-side rules.
  const validate = () => {
    const found = validateForm(schema, values)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) {
      // Move keyboard focus to the first invalid field.
      document.getElementById(Object.keys(found)[0]!)?.focus()
      return false
    }
    return true
  }

  const handleServerError = (err: unknown) => {
    const { message, fields } = parseApiError(err)
    setErrors(fields)
    setFormError(Object.keys(fields).length > 0 ? '' : message)
  }

  // Props that connect an input to its error message for screen readers.
  const fieldProps = (id: keyof T & string) => ({
    id,
    'aria-invalid': !!errors[id],
    'aria-describedby': errors[id] ? `${id}-error` : undefined,
  })

  return { values, setField, errors, formError, validate, handleServerError, fieldProps }
}
