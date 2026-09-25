import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type { CreateProductInput, UpdateProductInput } from '@shop-38/contracts'
import { apiClient } from '@/lib/api-client'

export type Product = InferResponseType<typeof apiClient.products.$get, 200>[number]

export const productKeys = {
  all: ['products'] as const,
}

/** Columns the API enforces as unique, and so can report back as already taken. */
const CONFLICT_FIELDS = ['slug', 'code'] as const

export type ProductConflictField = (typeof CONFLICT_FIELDS)[number]

/** A 409 from the API: another product already owns this slug or code. */
export class ProductConflictError extends Error {
  field: ProductConflictField

  constructor(field: ProductConflictField) {
    super(`product ${field} already taken`)
    this.name = 'ProductConflictError'
    this.field = field
  }
}

async function toError(response: Response, fallbackMessage: string): Promise<Error> {
  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as { field?: unknown } | null
    const field = CONFLICT_FIELDS.find((candidate) => candidate === body?.field)
    if (field) return new ProductConflictError(field)
  }
  if (response.status === 422) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null
    // The image was picked but its upload never got confirmed by S3.
    if (body?.error === 'invalid_image') {
      return new Error('Зураг бүрэн хуулагдаагүй байна. Зургаа дахин сонгоно уу.')
    }
    // The chosen category was deleted after the form loaded its list.
    return new Error('Сонгосон ангилал олдсонгүй. Ангилалаа дахин сонгоно уу.')
  }
  return new Error(fallbackMessage)
}

export function useProductsQuery() {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: async () => {
      const res = await apiClient.products.$get({ query: {} })
      if (!res.ok) throw new Error('Барааны жагсаалтыг татаж чадсангүй')
      return res.json()
    },
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const res = await apiClient.products.$post({ json: input })
      if (!res.ok) throw await toError(res, 'Бараа үүсгэж чадсангүй')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProductInput }) => {
      const res = await apiClient.products[':id'].$patch({ param: { id }, json: input })
      if (!res.ok) throw await toError(res, 'Барааны мэдээллийг хадгалж чадсангүй')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.products[':id'].$delete({ param: { id } })
      if (!res.ok) throw new Error('Барааг устгаж чадсангүй')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  })
}
