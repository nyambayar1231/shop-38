import type { ZodError } from 'zod'
import {
  MAX_PRODUCT_VARIANTS,
  variantCombinationKey,
  type ProductDetailsInput,
  type ProductStatus,
  type UpdateProductInput,
} from '@shop-38/contracts'
import type { ProductDetail } from './product-api'
import { regenerateVariants, type OptionDraft, type VariantDraft } from './variant-drafts'

// ---------------------------------------------------------------------------
// The product's own fields.
// ---------------------------------------------------------------------------

export type DetailsDraft = {
  name: string
  slug: string
  code: string
  categoryId: string
  status: ProductStatus
  description: string
  imageFileId: string | null
}

export type DetailField = 'name' | 'slug' | 'code' | 'categoryId' | 'description'

export type DetailErrors = Partial<Record<DetailField, string>>

export const initialDetails = (product: ProductDetail | null): DetailsDraft => ({
  name: product?.name ?? '',
  slug: product?.slug ?? '',
  code: product?.code ?? '',
  categoryId: product?.categoryId ?? '',
  status: product?.status ?? 'active',
  description: product?.description ?? '',
  imageFileId: product?.imageFileId ?? null,
})

/**
 * What the API receives. On create the slug is left out and the API derives it;
 * an existing one is only ever sent back as the user left it, never re-derived
 * from a renamed product.
 */
export const detailsPayload = (draft: DetailsDraft, isExisting: boolean) => ({
  name: draft.name.trim(),
  ...(isExisting ? { slug: draft.slug.trim() } : {}),
  code: draft.code.trim() || null,
  categoryId: draft.categoryId,
  status: draft.status,
  description: draft.description.trim() || null,
  imageFileId: draft.imageFileId,
})

/** Only the fields the user actually changed, so an untouched edit sends nothing. */
export function changedDetails(
  product: ProductDetail,
  next: ProductDetailsInput,
): UpdateProductInput | null {
  const patch: UpdateProductInput = {}
  if (next.name !== product.name) patch.name = next.name
  if (next.slug !== product.slug) patch.slug = next.slug
  if ((next.code ?? null) !== product.code) patch.code = next.code
  if (next.categoryId !== product.categoryId) patch.categoryId = next.categoryId
  if (next.status !== product.status) patch.status = next.status
  if ((next.description ?? null) !== product.description) patch.description = next.description
  if ((next.imageFileId ?? null) !== product.imageFileId) patch.imageFileId = next.imageFileId
  return Object.keys(patch).length > 0 ? patch : null
}

// ---------------------------------------------------------------------------
// Options and variants.
// ---------------------------------------------------------------------------

let nextOptionKey = 0
export const newOptionKey = () => `option-${++nextOptionKey}`

export function initialOptions(product: ProductDetail | null): OptionDraft[] {
  return (product?.options ?? []).map((option) => ({
    key: newOptionKey(),
    name: option.name,
    values: option.values,
  }))
}

export function initialVariants(product: ProductDetail | null): VariantDraft[] {
  if (!product) return regenerateVariants([], [], [], new Set())
  return product.variants.map((variant) => ({
    key: variantCombinationKey(variant.optionValues),
    id: variant.id,
    optionValues: variant.optionValues,
    sku: variant.sku ?? '',
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
  }))
}

/** What PUT /products/:id/variants would receive. Also how "did the variants change?" is decided. */
export function variantsPayload(options: OptionDraft[], variants: VariantDraft[]) {
  return {
    options: options.map((option) => ({ name: option.name.trim(), values: option.values })),
    variants: variants.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      optionValues: variant.optionValues,
      sku: variant.sku.trim() || null,
      price: variant.price,
      // Kept only while it still reads as a discount; a price raised to or past
      // it would otherwise be rejected over a field nobody can see.
      compareAtPrice:
        variant.compareAtPrice !== null &&
        variant.price !== null &&
        variant.compareAtPrice > variant.price
          ? variant.compareAtPrice
          : null,
    })),
  }
}

// ---------------------------------------------------------------------------
// Errors.
// ---------------------------------------------------------------------------

export type OptionErrors = Record<number, { name?: string; values?: string }>

export type VariantErrors = Record<string, { price?: string; sku?: string }>

export type FormErrors = {
  details: DetailErrors
  options: OptionErrors
  variants: VariantErrors
  /** About the variants as a whole, e.g. none left. */
  variantsGeneral?: string
}

export const NO_ERRORS: FormErrors = { details: {}, options: {}, variants: {} }

/** zod carries English messages, so each field's failures get Mongolian copy here. */
const DETAIL_MESSAGES: Record<DetailField, { invalid: string; tooLong: string }> = {
  name: {
    invalid: 'Барааны нэрийг оруулна уу.',
    tooLong: 'Нэр 200 тэмдэгтээс урт байж болохгүй.',
  },
  slug: {
    invalid: 'Slug зөвхөн жижиг латин үсэг, тоо болон дан зураасаас бүрдэнэ (жишээ нь: iphone-15).',
    tooLong: 'Slug 120 тэмдэгтээс урт байж болохгүй.',
  },
  code: {
    invalid: 'Код буруу байна.',
    tooLong: 'Код 64 тэмдэгтээс урт байж болохгүй.',
  },
  categoryId: {
    invalid: 'Ангилалаа сонгоно уу.',
    tooLong: 'Ангилалаа сонгоно уу.',
  },
  description: {
    invalid: 'Тайлбар буруу байна.',
    tooLong: 'Тайлбар 2000 тэмдэгтээс урт байж болохгүй.',
  },
}

/** The API's cross-field rule codes (see `checkOptionsAndVariants`), in Mongolian. */
const RULE_MESSAGES: Record<string, string> = {
  duplicate_option: 'Ийм нэртэй сонголт давхардсан байна.',
  duplicate_value: 'Утга давхардсан байна.',
  duplicate_sku: 'Энэ SKU өөр хувилбарт давхардсан байна.',
}

export const CONFLICT_MESSAGES = {
  slug: 'Ийм slug-тай бараа аль хэдийн бүртгэгдсэн байна.',
  code: 'Ийм кодтой бараа аль хэдийн бүртгэгдсэн байна.',
  sku: 'Энэ SKU өөр хувилбарт бүртгэгдсэн байна.',
  /** Two saves raced for the same generated SKU; saving again picks the next free one. */
  generatedSku: 'SKU үүсгэхэд давхцал гарлаа. Дахин хадгална уу.',
}

/**
 * Maps zod issues onto the inputs that caused them. Paths are the payload's:
 * `options.1.name`, `variants.3.price`… — and payload order is draft order.
 */
export function toFormErrors(error: ZodError, variants: VariantDraft[]): FormErrors {
  const errors: FormErrors = { details: {}, options: {}, variants: {} }
  for (const issue of error.issues) {
    const [head, index, field] = issue.path as [string, number | undefined, string | undefined]
    const rule = RULE_MESSAGES[issue.message]

    if (head === 'options' && typeof index === 'number') {
      const target = (errors.options[index] ??= {})
      if (field === 'name') target.name ??= rule ?? 'Сонголтын нэрийг оруулна уу (50 тэмдэгт хүртэл).'
      if (field === 'values') target.values ??= rule ?? 'Утга 50 тэмдэгтээс урт байж болохгүй.'
      continue
    }

    if (head === 'variants') {
      const draft = typeof index === 'number' ? variants[index] : undefined
      if (!draft) {
        errors.variantsGeneral ??=
          issue.code === 'too_big'
            ? `Нэг бараа ${MAX_PRODUCT_VARIANTS}-аас олон хувилбартай байж болохгүй.`
            : 'Дор хаяж нэг хувилбар үлдээнэ үү.'
        continue
      }
      const target = (errors.variants[draft.key] ??= {})
      if (field === 'price') target.price ??= 'Үнэ оруулна уу.'
      else if (field === 'sku') target.sku ??= rule ?? 'SKU 64 тэмдэгтээс урт байж болохгүй.'
      else errors.variantsGeneral ??= 'Хувилбаруудыг шалгана уу.'
      continue
    }

    const detail = head as DetailField
    const messages = DETAIL_MESSAGES[detail]
    // First issue per field wins — showing one reason at a time is enough.
    if (!messages || errors.details[detail]) continue
    errors.details[detail] = issue.code === 'too_big' ? messages.tooLong : messages.invalid
  }
  return errors
}

/** An option the user started but did not finish would otherwise be silently dropped. */
export function incompleteOptionErrors(options: OptionDraft[]): OptionErrors {
  const errors: OptionErrors = {}
  options.forEach((option, i) => {
    if (!option.name.trim()) errors[i] = { name: 'Сонголтын нэрийг оруулна уу.' }
    else if (option.values.length === 0) errors[i] = { values: 'Дор хаяж нэг утга нэмнэ үү.' }
  })
  return errors
}

export function mergeErrors(a: FormErrors, b: FormErrors): FormErrors {
  return {
    details: { ...b.details, ...a.details },
    options: { ...b.options, ...a.options },
    variants: { ...b.variants, ...a.variants },
    variantsGeneral: a.variantsGeneral ?? b.variantsGeneral,
  }
}

export const hasErrors = (errors: FormErrors) =>
  Object.keys(errors.details).length > 0 ||
  Object.keys(errors.options).length > 0 ||
  Object.keys(errors.variants).length > 0 ||
  Boolean(errors.variantsGeneral)
