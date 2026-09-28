import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { store } from '@/app/store'
import { AuthBootstrap } from '@/features/auth/AuthBootstrap'
import { router } from '@/routes/router'

export default function App() {
  return (
    <Provider store={store}>
      <TooltipProvider>
        <AuthBootstrap>
          <RouterProvider router={router} />
        </AuthBootstrap>
        <Toaster />
      </TooltipProvider>
    </Provider>
  )
}
