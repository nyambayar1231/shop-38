import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type {
  CreateProductInput,
  UpdateProductInput,
  UpdateProductVariantsInput,
} from '@shop-38/contracts'
import { apiClient } from '@/lib/api-client'

export type Product = InferResponseType<typeof apiClient.products.$get, 200>[number]

export type ProductDetail = InferResponseType<(typeof apiClient.products)[':id']['$get'], 200>

export type ProductVariant = ProductDetail['variants'][number]

export const productKeys = {
  all: ['products'] as const,
  detail: (id: string) => ['products', id] as const,
}

/** Columns the API enforces as unique, and so can report back as already taken. */
const CONFLICT_FIELDS = ['slug', 'code', 'sku'] as const

export type ProductConflictField = (typeof CONFLICT_FIELDS)[number]

/** A 409 from the API: another product (or, for `sku`, another variant) already owns this value. */
export class ProductConflictError extends Error {
  field: ProductConflictField
  /** For `sku`: which one, since a product has many. */
  value: string | undefined

  constructor(field: ProductConflictField, value?: string) {
    super(`product ${field} already taken`)
    this.name = 'ProductConflictError'
    this.field = field
    this.value = value
  }
}

async function toError(response: Response, fallbackMessage: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown
    field?: unknown
    value?: unknown
  } | null
  if (response.status === 409) {
    const field = CONFLICT_FIELDS.find((candidate) => candidate === body?.field)
    if (field) {
      return new ProductConflictError(field, typeof body?.value === 'string' ? body.value : undefined)
    }
    if (body?.error === 'product_has_stock_history') {
      return new Error(
        'Энэ бараанд нөөцийн түүх бий тул устгах боломжгүй. Оронд нь төлөвийг «Архивласан» болгоно уу.',
      )
    }
  }
  if (response.status === 422) {
    // The image was picked but its upload never got confirmed by S3.
    if (body?.error === 'invalid_image') {
      return new Error('Зураг бүрэн хуулагдаагүй байна. Зургаа дахин сонгоно уу.')
    }
    // Someone else removed a variant while this form was open.
    if (body?.error === 'unknown_variant') {
      return new Error('Барааны хувилбарууд өөрчлөгдсөн байна. Хуудсаа сэргээгээд дахин оролдоно уу.')
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

export class ProductNotFoundError extends Error {}

export function useProductQuery(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.products[':id'].$get({ param: { id } })
      if (res.status === 404) throw new ProductNotFoundError('Бараа олдсонгүй')
      if (!res.ok) throw new Error('Барааны мэдээллийг татаж чадсангүй')
      return res.json()
    },
    retry: (count, error) => !(error instanceof ProductNotFoundError) && count < 3,
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
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(product.id), product)
      return queryClient.invalidateQueries({ queryKey: productKeys.all, exact: true })
    },
  })
}

/**
 * Saves a product edit: its own fields, then its options and variants, each only
 * if it changed. Two requests, in that order, so a rejected detail edit (a taken
 * code, say) stops before any variant is touched.
 */
export function useSaveProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      details,
      variants,
    }: {
      id: string
      details: UpdateProductInput | null
      variants: UpdateProductVariantsInput | null
    }) => {
      let product: ProductDetail | undefined
      if (details) {
        const res = await apiClient.products[':id'].$patch({ param: { id }, json: details })
        if (!res.ok) throw await toError(res, 'Барааны мэдээллийг хадгалж чадсангүй')
        product = await res.json()
      }
      if (variants) {
        const res = await apiClient.products[':id'].variants.$put({ param: { id }, json: variants })
        if (!res.ok) throw await toError(res, 'Барааны хувилбаруудыг хадгалж чадсангүй')
        product = await res.json()
      }
      return product
    },
    onSuccess: (product, { id }) => {
      if (product) queryClient.setQueryData(productKeys.detail(id), product)
    },
    onSettled: (_product, _error, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: productKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: productKeys.all, exact: true }),
        queryClient.invalidateQueries({ queryKey: ['variants'] }),
      ]),
  })
}

/** Status alone, for the list's quick actions. */
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
      if (!res.ok) throw await toError(res, 'Барааг устгаж чадсангүй')
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: productKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: productKeys.all, exact: true })
    },
  })
}
