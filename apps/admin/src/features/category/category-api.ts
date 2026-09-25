import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type { CreateCategoryInput, UpdateCategoryInput } from '@shop-38/contracts'
import { apiClient } from '@/lib/api-client'
import { productKeys } from '@/features/product/product-api'

export type Category = InferResponseType<typeof apiClient.categories.$get>[number]

export const categoryKeys = {
  all: ['categories'] as const,
}

/** Columns the API enforces as unique, and so can report back as already taken. */
const CONFLICT_FIELDS = ['name', 'slug'] as const

export type CategoryConflictField = (typeof CONFLICT_FIELDS)[number]

/** A 409 from the API: another category already owns this name or slug. */
export class CategoryConflictError extends Error {
  field: CategoryConflictField

  constructor(field: CategoryConflictField) {
    super(`category ${field} already taken`)
    this.name = 'CategoryConflictError'
    this.field = field
  }
}

async function toError(response: Response, fallbackMessage: string): Promise<Error> {
  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as { field?: unknown } | null
    const field = CONFLICT_FIELDS.find((candidate) => candidate === body?.field)
    if (field) return new CategoryConflictError(field)
  }
  // The image was picked but its upload never got confirmed by S3.
  if (response.status === 422) {
    return new Error('Зураг бүрэн хуулагдаагүй байна. Зургаа дахин сонгоно уу.')
  }
  return new Error(fallbackMessage)
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: async () => {
      const res = await apiClient.categories.$get()
      if (!res.ok) throw new Error('Ангилалын жагсаалтыг татаж чадсангүй')
      return res.json()
    },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const res = await apiClient.categories.$post({ json: input })
      if (!res.ok) throw await toError(res, 'Ангилал үүсгэж чадсангүй')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCategoryInput }) => {
      const res = await apiClient.categories[':id'].$patch({ param: { id }, json: input })
      if (!res.ok) throw await toError(res, 'Ангилалын мэдээллийг хадгалж чадсангүй')
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all })
      // The product list shows each product's category name.
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.categories[':id'].$delete({ param: { id } })
      // Thrown as an HTTPException, so the RPC types don't list it among the statuses.
      if ((res.status as number) === 409) {
        throw new Error('Энэ ангилалд бараа бүртгэлтэй тул устгах боломжгүй. Эхлээд барааг өөр ангилалд шилжүүлнэ үү.')
      }
      if (!res.ok) throw new Error('Ангилалыг устгаж чадсангүй')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  })
}
