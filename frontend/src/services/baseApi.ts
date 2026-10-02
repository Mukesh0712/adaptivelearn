import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import { toast } from 'sonner'
import { credentialsReceived, loggedOut } from '@/features/auth/authSlice'
import type { AuthResponse } from '@/features/auth/types'

// Minimal view of the store state, to avoid a circular import with store.ts.
interface StateWithAuth {
  auth: { accessToken: string | null; status: string }
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api', // proxied to the backend by Vite in development
  credentials: 'include', // send/receive the httpOnly refresh cookie
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as StateWithAuth).auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// Only one /refresh request may be in flight at a time. The backend ROTATES
// the refresh token, so two parallel refreshes would send the same cookie
// twice; the second would look like a replayed (stolen) token and the
// backend would end the session. Everyone waiting shares this one promise.
let refreshInFlight: Promise<AuthResponse | null> | null = null

export function refreshSession(
  api: Parameters<BaseQueryFn>[1],
  extraOptions: object = {},
): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    // 200 → new tokens. 204 (no session cookie) or 401 (invalid session) → logged out.
    const result = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions)
    if (result.data) {
      const data = result.data as AuthResponse
      api.dispatch(credentialsReceived(data))
      return data
    }
    api.dispatch(loggedOut())
    return null
  })().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

// Requests where a 401 means "wrong credentials", not "access token expired".
const NO_RETRY = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/invite',
  '/auth/accept-invite',
]

// Wraps every API call: if the access token has expired (401), silently get
// a new one with the refresh cookie and retry the original request once.
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  const url = typeof args === 'string' ? args : args.url
  if (result.error?.status === 401 && !NO_RETRY.includes(url)) {
    const wasLoggedIn = (api.getState() as StateWithAuth).auth.status === 'authenticated'
    if (await refreshSession(api, extraOptions)) {
      result = await rawBaseQuery(args, api, extraOptions)
    } else if (wasLoggedIn) {
      toast.error('Your session has expired. Please log in again.')
    }
  }
  return result
}

// Feature slices add their endpoints with baseApi.injectEndpoints(...).
// Tags link cached queries to the mutations that change them: e.g. sending
// an invite marks 'Users' as stale, so the Users list refetches by itself.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Users', 'AuditLogs', 'Courses'],
  endpoints: () => ({}),
})
