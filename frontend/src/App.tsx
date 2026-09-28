import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'
import { store } from '@/app/store'
import { AuthBootstrap } from '@/features/auth/AuthBootstrap'
import { router } from '@/routes/router'

export default function App() {
  return (
    <Provider store={store}>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
    </Provider>
  )
}
