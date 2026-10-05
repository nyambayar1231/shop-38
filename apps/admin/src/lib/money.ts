const moneyFormat = new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 0 })

/** Whole tögrög, grouped: `45 000₮`. */
export function formatMoney(amount: number): string {
  return `${moneyFormat.format(amount)}₮`
}

/** `45 000₮`, or `45 000₮ – 55 000₮` when variants differ. */
export function formatPriceRange(min: number | null, max: number | null): string {
  if (min === null || max === null) return '—'
  return min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`
}
