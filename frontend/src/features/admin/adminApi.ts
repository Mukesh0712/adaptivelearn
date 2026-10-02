import { baseApi } from '@/services/baseApi'
import type { ListUsersParams, ListUsersResponse } from './types'

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // GET /api/admin/users. Each different set of params is cached separately,
    // so going back to a page you've already seen is instant.
    listUsers: build.query<ListUsersResponse, ListUsersParams>({
      query: (params) => ({ url: '/admin/users', params }),
    }),
  }),
})

export const { useListUsersQuery } = adminApi
