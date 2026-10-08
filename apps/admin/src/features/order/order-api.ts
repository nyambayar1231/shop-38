import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type { CreateOrderInput, UpdateOrderStatusInput } from '@shop-38/contracts'
import { apiClient } from '@/lib/api-client'

export type Order = InferResponseType<typeof apiClient.orders.$get, 200>[number]

export type OrderDetail = InferResponseType<(typeof apiClient.orders)[':id']['$get'], 200>

export const orderKeys = {
  all: ['orders'] as const,
  lists: ['orders', 'list'] as const,
  list: (filter: { customerId?: string }) => ['orders', 'list', filter] as const,
  detail: (id: string) => ['orders', id] as const,
}

/** A 422 from the API: the chosen customer was deleted while the form was open. */
export class UnknownCustomerError extends Error {
  constructor() {
    super('Сонгосон хэрэглэгч олдсонгүй. Хэрэглэгчээ дахин сонгоно уу.')
    this.name = 'UnknownCustomerError'
  }
}

/** A 422 from the API: these variants were archived, deleted or unpriced while the form was open. */
export class UnavailableVariantsError extends Error {
  variantIds: string[]

  constructor(variantIds: string[]) {
    super('Зарим бараа захиалах боломжгүй болсон байна. Тэмдэглэсэн мөрүүдийг засна уу.')
    this.name = 'UnavailableVariantsError'
    this.variantIds = variantIds
  }
}

/** Every order, or one customer's. */
export function useOrdersQuery(filter: { customerId?: string } = {}) {
  return useQuery({
    queryKey: orderKeys.list(filter),
    queryFn: async () => {
      const res = await apiClient.orders.$get({ query: filter })
      if (!res.ok) throw new Error('Захиалгын жагсаалтыг татаж чадсангүй')
      return res.json()
    },
  })
}

export class OrderNotFoundError extends Error {}

export function useOrderQuery(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.orders[':id'].$get({ param: { id } })
      if (res.status === 404) throw new OrderNotFoundError('Захиалга олдсонгүй')
      if (!res.ok) throw new Error('Захиалгын мэдээллийг татаж чадсангүй')
      return res.json()
    },
    retry: (count, error) => !(error instanceof OrderNotFoundError) && count < 3,
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const res = await apiClient.orders.$post({ json: input })
      if (!res.ok) {
        // The API's own 422 is thrown as an HTTPException, so hono's client types don't know it.
        const response = res as Response
        const body = (await response.json().catch(() => null)) as {
          error?: unknown
          variantIds?: unknown
        } | null
        if (response.status === 422 && Array.isArray(body?.variantIds)) {
          throw new UnavailableVariantsError(body.variantIds)
        }
        if (response.status === 422 && body?.error === 'unknown_customer') {
          throw new UnknownCustomerError()
        }
        throw new Error('Захиалга үүсгэж чадсангүй')
      }
      return res.json()
    },
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.lists }),
        // The customer list counts each customer's orders.
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
      ])
    },
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateOrderStatusInput }) => {
      const res = await apiClient.orders[':id'].status.$patch({ param: { id }, json: input })
      if (res.status === 409) {
        throw new Error('Энэ захиалга аль хэдийн хаагдсан байна. Хуудсаа сэргээнэ үү.')
      }
      if (!res.ok) throw new Error('Захиалгын төлөвийг өөрчилж чадсангүй')
      return res.json()
    },
    onSuccess: (order) => queryClient.setQueryData(orderKeys.detail(order.id), order),
    onSettled: (_order, _error, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: orderKeys.lists }),
      ]),
  })
}
