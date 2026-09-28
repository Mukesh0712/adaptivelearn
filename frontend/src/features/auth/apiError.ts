import type { ApiErrorBody } from './types'

// Turns an RTK Query error (as thrown by `.unwrap()`) into something a form
// can display: a general message plus per-field messages from the backend's
// zod validation.
export function parseApiError(error: unknown): { message: string; fields: Record<string, string> } {
  if (!error || typeof error !== 'object') {
    return { message: 'Something went wrong. Please try again.', fields: {} }
  }

  if ('status' in error) {
    if (error.status === 'FETCH_ERROR') {
      return { message: 'Cannot reach the server. Check your connection and try again.', fields: {} }
    }
    const body = ('data' in error ? error.data : undefined) as Partial<ApiErrorBody> | undefined
    const fields: Record<string, string> = {}
    for (const [key, messages] of Object.entries(body?.details ?? {})) {
      if (messages?.[0]) fields[key] = messages[0]
    }
    return { message: body?.message ?? 'Something went wrong. Please try again.', fields }
  }

  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return { message: message || 'Something went wrong. Please try again.', fields: {} }
}
