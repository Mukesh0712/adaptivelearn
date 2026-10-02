import { baseApi } from '@/services/baseApi'
import type {
  AuditLog,
  InviteRequest,
  InviteResponse,
  ListUsersParams,
  ListUsersResponse,
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
    listAuditLogs: build.query<{ logs: AuditLog[] }, { limit: number }>({
      query: (params) => ({ url: '/admin/audit-logs', params }),
      providesTags: ['AuditLogs'],
    }),
  }),
})

export const { useListUsersQuery, useInviteUserMutation, useListAuditLogsQuery } = adminApi
