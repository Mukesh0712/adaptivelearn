import { Check, Copy } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// Copies `value` to the clipboard and briefly shows a tick.
export function CopyButton({
  value,
  label,
  successMessage = 'Copied',
  ...props
}: { value: string; label: string; successMessage?: string } & ComponentProps<typeof Button>) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successMessage)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked (e.g. plain http or browser settings).
      toast.error(`Couldn't copy automatically. The code is ${value}`)
    }
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={() => void copy()} {...props}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  )
}
