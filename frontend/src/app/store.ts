import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from '@/features/auth/authSlice'
import { baseApi } from '@/services/baseApi'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  // RTK Query's middleware handles caching, refetching and request lifecycles.
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
