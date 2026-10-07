import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type { ChangeVariantPriceInput } from '@shop-38/contracts'
import { apiClient } from '@/lib/api-client'
import { productKeys } from '@/features/product/product-api'

export type VariantDetail = InferResponseType<(typeof apiClient.variants)[':id']['$get'], 200>

export type PriceRecord = InferResponseType<(typeof apiClient.variants)[':id']['prices']['$get'], 200>[number]

export const variantKeys = {
  all: ['variants'] as const,
  detail: (id: string) => ['variants', id] as const,
  prices: (id: string) => ['variants', id, 'prices'] as const,
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
    // The price shows here, on the product list and the product editor.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: variantKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
      ]),
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
