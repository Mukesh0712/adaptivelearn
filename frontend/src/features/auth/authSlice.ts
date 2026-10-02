import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthResponse, User } from './types'

// 'checking' = app just loaded, we don't know yet whether a session exists
// (AuthBootstrap is asking the backend via /refresh).
type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

interface AuthState {
  user: User | null
  // Kept ONLY in memory (Redux), never in localStorage: an XSS script can't
  // steal it from storage, and after a page reload we get a new one via the
  // httpOnly refresh cookie.
  accessToken: string | null
  status: AuthStatus
}

const initialState: AuthState = { user: null, accessToken: null, status: 'checking' }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived(state, action: PayloadAction<AuthResponse>) {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.status = 'authenticated'
    },
    // The user's own details changed (e.g. their name on the Profile page).
    userUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload
    },
    loggedOut(state) {
      state.user = null
      state.accessToken = null
      state.status = 'unauthenticated'
    },
  },
})

export const { credentialsReceived, userUpdated, loggedOut } = authSlice.actions
export const authReducer = authSlice.reducer
