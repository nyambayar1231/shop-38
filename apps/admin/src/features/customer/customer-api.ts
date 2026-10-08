import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type { CreateCustomerInput, UpdateCustomerInput } from '@shop-38/contracts'
import { apiClient } from '@/lib/api-client'
import { orderKeys } from '@/features/order/order-api'

export type Customer = InferResponseType<typeof apiClient.customers.$get, 200>[number]

export type CustomerDetail = InferResponseType<(typeof apiClient.customers)[':id']['$get'], 200>

export const customerKeys = {
  all: ['customers'] as const,
  detail: (id: string) => ['customers', id] as const,
}

/** Columns the API enforces as unique, and so can report back as already taken. */
const CONFLICT_FIELDS = ['phone', 'email'] as const

export type CustomerConflictField = (typeof CONFLICT_FIELDS)[number]

/** A 409 from the API: another customer already has this phone or email. */
export class CustomerConflictError extends Error {
  field: CustomerConflictField

  constructor(field: CustomerConflictField) {
    super(`customer ${field} already taken`)
    this.name = 'CustomerConflictError'
    this.field = field
  }
}

async function toError(response: Response, fallbackMessage: string): Promise<Error> {
  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown
      field?: unknown
    } | null
    const field = CONFLICT_FIELDS.find((candidate) => candidate === body?.field)
    if (field) return new CustomerConflictError(field)
    if (body?.error === 'customer_has_orders') {
      return new Error('Захиалгатай хэрэглэгчийг устгах боломжгүй.')
    }
  }
  return new Error(fallbackMessage)
}

export function useCustomersQuery() {
  return useQuery({
    queryKey: customerKeys.all,
    queryFn: async () => {
      const res = await apiClient.customers.$get()
      if (!res.ok) throw new Error('Хэрэглэгчийн жагсаалтыг татаж чадсангүй')
      return res.json()
    },
  })
}

export class CustomerNotFoundError extends Error {}

export function useCustomerQuery(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.customers[':id'].$get({ param: { id } })
      if (res.status === 404) throw new CustomerNotFoundError('Хэрэглэгч олдсонгүй')
      if (!res.ok) throw new Error('Хэрэглэгчийн мэдээллийг татаж чадсангүй')
      return res.json()
    },
    retry: (count, error) => !(error instanceof CustomerNotFoundError) && count < 3,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const res = await apiClient.customers.$post({ json: input })
      if (!res.ok) throw await toError(res, 'Хэрэглэгч үүсгэж чадсангүй')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all, exact: true }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCustomerInput }) => {
      const res = await apiClient.customers[':id'].$patch({ param: { id }, json: input })
      if (!res.ok) throw await toError(res, 'Хэрэглэгчийн мэдээллийг хадгалж чадсангүй')
      return res.json()
    },
    onSuccess: (customer) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), customer)
      void queryClient.invalidateQueries({ queryKey: customerKeys.all, exact: true })
      // Orders show their customer's name and phone.
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.customers[':id'].$delete({ param: { id } })
      if (!res.ok) throw await toError(res as Response, 'Хэрэглэгчийг устгаж чадсангүй')
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: customerKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: customerKeys.all, exact: true })
    },
  })
}
