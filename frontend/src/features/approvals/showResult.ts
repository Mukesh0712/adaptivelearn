import { toast } from 'sonner'
import type { ApprovalResult } from './approvalsApi'

// Green toast when everything went through; amber when some were already
// handled by someone else (e.g. the admin and the instructor at once).
export function showApprovalResult(result: ApprovalResult) {
  const allDone = result.results.every((r) => r.outcome === 'done')
  if (allDone) toast.success(result.message)
  else toast.warning(result.message)
}
