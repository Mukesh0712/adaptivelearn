import { baseApi } from '@/services/baseApi'
import type {
  AssignableRole,
  AuditLog,
  InviteRequest,
  InviteResponse,
  ListUsersParams,
  ListUsersResponse,
  UserActionResponse,
} from './types'

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /api/admin/users. Each different set of params is cached separately,
    // so going back to a page you've already seen is instant.
    listUsers: build.query<ListUsersResponse, ListUsersParams>({
      query: (params) => ({ url: '/admin/users', params }),
      providesTags: ['Users'],
    }),
    inviteUser: build.mutation<InviteResponse, InviteRequest>({
      query: (body) => ({ url: '/admin/invites', method: 'POST', body }),
      invalidatesTags: ['Users', 'AuditLogs'],
    }),
    resendInvite: build.mutation<InviteResponse, string>({
      query: (id) => ({ url: `/admin/users/${id}/resend-invite`, method: 'POST' }),
      invalidatesTags: ['Users', 'AuditLogs'],
    }),
    changeRole: build.mutation<UserActionResponse, { id: string; role: AssignableRole }>({
      query: ({ id, role }) => ({ url: `/admin/users/${id}/role`, method: 'PATCH', body: { role } }),
      invalidatesTags: ['Users', 'AuditLogs'],
    }),
    changeStatus: build.mutation<UserActionResponse, { id: string; status: 'active' | 'deactivated' }>({
      query: ({ id, status }) => ({ url: `/admin/users/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['Users', 'AuditLogs'],
    }),
    listAuditLogs: build.query<{ logs: AuditLog[] }, { limit: number }>({
      query: (params) => ({ url: '/admin/audit-logs', params }),
      providesTags: ['AuditLogs'],
    }),
  }),
})

export const {
  useListUsersQuery,
  useInviteUserMutation,
  useResendInviteMutation,
  useChangeRoleMutation,
  useChangeStatusMutation,
  useListAuditLogsQuery,
} = adminApi
