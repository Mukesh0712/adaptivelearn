import type { ComponentProps, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Full-width form button that shows a spinner and blocks double submits
// while the request is in flight.
export function SubmitButton({
  loading,
  loadingText,
  children,
  ...props
}: ComponentProps<typeof Button> & { loading: boolean; loadingText: string; children: ReactNode }) {
  return (
    <Button type="submit" className="w-full" disabled={loading} aria-busy={loading} {...props}>
      {loading ? (
        <>
          <LoaderCircle className="animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
