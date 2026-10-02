import { baseApi } from '@/services/baseApi'
import { credentialsReceived, userUpdated } from '@/features/auth/authSlice'
import type { AuthResponse, User } from '@/features/auth/types'

export const profileApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    updateProfile: build.mutation<{ user: User; message: string }, { name: string }>({
      query: (body) => ({ url: '/profile', method: 'PATCH', body }),
      // Show the new name everywhere (header, menu) right away.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          dispatch(userUpdated((await queryFulfilled).data.user))
        } catch {
          // the form shows the error
        }
      },
    }),
    // The server starts a fresh session for this device (other devices are
    // logged out), so store the new access token it returns.
    changePassword: build.mutation<AuthResponse & { message: string }, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/profile/password', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          dispatch(credentialsReceived((await queryFulfilled).data))
        } catch {
          // the form shows the error
        }
      },
    }),
  }),
})

export const { useUpdateProfileMutation, useChangePasswordMutation } = profileApi
