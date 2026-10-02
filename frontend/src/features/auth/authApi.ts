import { baseApi, refreshSession } from '@/services/baseApi'
import { credentialsReceived, loggedOut } from './authSlice'
import type {
  AuthResponse,
  InviteDetails,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  RegisterResponse,
  User,
} from './types'

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Registration only creates the account; the user then logs in.
    register: build.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled
        dispatch(credentialsReceived(data))
      },
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // Log out locally even if the request fails (e.g. server down).
        await queryFulfilled.catch(() => undefined)
        dispatch(loggedOut())
        dispatch(baseApi.util.resetApiState()) // drop any cached user data
      },
    }),
    // Uses the shared refreshSession() so it can never race with an automatic
    // refresh triggered by a 401 elsewhere.
    refresh: build.mutation<AuthResponse, void>({
      async queryFn(_arg, api) {
        const data = await refreshSession(api)
        return data
          ? { data }
          : { error: { status: 401, data: { message: 'No active session' } } }
      },
    }),
    me: build.query<{ user: User }, void>({
      query: () => '/auth/me',
    }),
    forgotPassword: build.mutation<MessageResponse, { email: string; website: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),
    resetPassword: build.mutation<MessageResponse, { token: string; password: string }>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    // Invite links (sent by an Admin): check the link, then activate the account.
    verifyInvite: build.query<InviteDetails, string>({
      query: (token) => ({ url: '/auth/invite', params: { token } }),
    }),
    acceptInvite: build.mutation<
      MessageResponse & { email: string },
      { token: string; password: string; acceptTerms: boolean }
    >({
      query: (body) => ({ url: '/auth/accept-invite', method: 'POST', body }),
    }),
  }),
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshMutation,
  useMeQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyInviteQuery,
  useAcceptInviteMutation,
} = authApi
