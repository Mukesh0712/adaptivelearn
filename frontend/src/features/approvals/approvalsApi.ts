import { baseApi } from '@/services/baseApi'
import type { Role } from '@/lib/roles'

export interface ApprovalRequest {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
  course: { id: string; title: string } | null // the class a student asked to join
}

// Result of any bulk action (approvals, invites): one outcome per person.
export interface ApprovalResult {
  results: { id: string; outcome: 'done' | 'already_handled' | 'not_allowed'; by?: string }[]
  message: string // e.g. "3 approved · 1 already handled by someone else"
}

export const approvalsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // Admin: all pending sign-ups. Instructor: students asking to join their courses.
    listApprovals: build.query<
      { requests: ApprovalRequest[]; total: number; page: number; pageSize: number; totalPages: number },
      { page: number; pageSize: number }
    >({
      query: (params) => ({ url: '/approvals', params }),
      providesTags: ['Approvals'],
    }),
    // Both take a list of ids: one person is just a list of one.
    approveRequests: build.mutation<ApprovalResult, string[]>({
      query: (ids) => ({ url: '/approvals/approve', method: 'POST', body: { ids } }),
      invalidatesTags: ['Approvals', 'Users', 'Courses', 'AuditLogs'],
    }),
    rejectRequests: build.mutation<ApprovalResult, string[]>({
      query: (ids) => ({ url: '/approvals/reject', method: 'POST', body: { ids } }),
      invalidatesTags: ['Approvals', 'Users', 'AuditLogs'],
    }),
  }),
})

export const { useListApprovalsQuery, useApproveRequestsMutation, useRejectRequestsMutation } = approvalsApi
