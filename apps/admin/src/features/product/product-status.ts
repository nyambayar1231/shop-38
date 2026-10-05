import type { ProductStatus } from '@shop-38/contracts'

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Ноорог',
  active: 'Идэвхтэй',
  archived: 'Архивласан',
}

export const PRODUCT_STATUS_HINTS: Record<ProductStatus, string> = {
  draft: 'Бэлтгэж байгаа. Дэлгүүрт харагдахгүй.',
  active: 'Дэлгүүрт харагдаж, зарагдана.',
  archived: 'Зарахаа больсон. Түүх нь хадгалагдана.',
}
