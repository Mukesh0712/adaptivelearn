import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'
import type { ApiErrorBody } from './types'

// Turns an RTK Query error into something a form can display:
// a general message plus per-field messages from the backend's zod validation.
export function parseApiError(error: FetchBaseQueryError | SerializedError | undefined): {
  message: string
  fields: Record<string, string>
} {
  if (!error) return { message: '', fields: {} }

  if ('status' in error) {
    if (error.status === 'FETCH_ERROR') {
      return { message: 'Cannot reach the server. Is the backend running?', fields: {} }
    }
    const body = error.data as Partial<ApiErrorBody> | undefined
    const fields: Record<string, string> = {}
    for (const [key, messages] of Object.entries(body?.details ?? {})) {
      if (messages?.[0]) fields[key] = messages[0]
    }
    return { message: body?.message ?? 'Something went wrong. Please try again.', fields }
  }
  return { message: error.message ?? 'Something went wrong. Please try again.', fields: {} }
}
