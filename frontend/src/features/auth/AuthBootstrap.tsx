import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/app/hooks'
import { FullPageLoader } from '@/components/FullPageLoader'
import { useRefreshMutation } from './authApi'

// Runs once when the app loads. The access token lives only in memory, so
// after a page reload it's gone; we ask the backend for a new one using the
// httpOnly refresh cookie. Success → logged in; failure → logged out.
// Until the answer arrives we show a loader, so protected pages don't flash
// the login screen for a user who is actually still logged in.
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [refresh] = useRefreshMutation()
  const { status } = useAuth()

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (status === 'checking') return <FullPageLoader />
  return children
}
