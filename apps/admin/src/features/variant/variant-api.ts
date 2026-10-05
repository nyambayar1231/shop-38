import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type { ChangeVariantPriceInput, CreateStockMovementInput } from '@shop-38/contracts'
import { apiClient } from '@/lib/api-client'
import { productKeys } from '@/features/product/product-api'

export type InventoryVariant = InferResponseType<typeof apiClient.variants.$get, 200>[number]

export type VariantDetail = InferResponseType<(typeof apiClient.variants)[':id']['$get'], 200>

export type StockMovement = InferResponseType<
  (typeof apiClient.variants)[':id']['stock-movements']['$get'],
  200
>[number]

export type PriceRecord = InferResponseType<(typeof apiClient.variants)[':id']['prices']['$get'], 200>[number]

export const variantKeys = {
  all: ['variants'] as const,
  list: (search: string) => ['variants', 'list', search] as const,
  detail: (id: string) => ['variants', id] as const,
  movements: (id: string) => ['variants', id, 'stock-movements'] as const,
  prices: (id: string) => ['variants', id, 'prices'] as const,
}

export function useVariantsQuery(search: string) {
  return useQuery({
    queryKey: variantKeys.list(search),
    queryFn: async () => {
      const res = await apiClient.variants.$get({ query: search ? { search } : {} })
      if (!res.ok) throw new Error('Нөөцийн жагсаалтыг татаж чадсангүй')
      return res.json()
    },
    // Typing in the search box must not flash an empty table between keystrokes.
    placeholderData: (previous) => previous,
  })
}

export function useVariantQuery(id: string) {
  return useQuery({
    queryKey: variantKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.variants[':id'].$get({ param: { id } })
      if (!res.ok) throw new Error('Хувилбар олдсонгүй')
      return res.json()
    },
  })
}

export function useChangePrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ChangeVariantPriceInput }) => {
      const res = await apiClient.variants[':id'].prices.$post({ param: { id }, json: input })
      if (!res.ok) throw new Error('Үнийг өөрчилж чадсангүй')
      return res.json()
    },
    // The price shows here, on the inventory page, the product list and the product editor.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: variantKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
      ]),
  })
}

export function useStockMovementsQuery(id: string) {
  return useQuery({
    queryKey: variantKeys.movements(id),
    queryFn: async () => {
      const res = await apiClient.variants[':id']['stock-movements'].$get({ param: { id } })
      if (!res.ok) throw new Error('Нөөцийн түүхийг татаж чадсангүй')
      return res.json()
    },
  })
}

export function usePricesQuery(id: string) {
  return useQuery({
    queryKey: variantKeys.prices(id),
    queryFn: async () => {
      const res = await apiClient.variants[':id'].prices.$get({ param: { id } })
      if (!res.ok) throw new Error('Үнийн түүхийг татаж чадсангүй')
      return res.json()
    },
  })
}

/** A 422 from the API: the movement would take stock below zero. */
export class InsufficientStockError extends Error {
  stock: number

  constructor(stock: number) {
    super(`only ${stock} in stock`)
    this.name = 'InsufficientStockError'
    this.stock = stock
  }
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CreateStockMovementInput }) => {
      const res = await apiClient.variants[':id']['stock-movements'].$post({
        param: { id },
        json: input,
      })
      // Thrown as an HTTPException, so it is not part of the route's inferred response types.
      if ((res.status as number) === 422) {
        const body = (await (res as Response).json().catch(() => null)) as { stock?: unknown } | null
        if (typeof body?.stock === 'number') throw new InsufficientStockError(body.stock)
      }
      if (!res.ok) throw new Error('Нөөцийн өөрчлөлтийг хадгалж чадсангүй')
      return res.json()
    },
    // Stock shows on the inventory page, the product list and the product editor.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: variantKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
      ]),
  })
}
