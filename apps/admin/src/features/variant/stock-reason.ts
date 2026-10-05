import { MANUAL_STOCK_REASONS, type ManualStockReason, type StockReason } from '@shop-38/contracts'

export const STOCK_REASON_LABELS: Record<StockReason, string> = {
  initial: 'Эхний үлдэгдэл',
  receipt: 'Орлого',
  return: 'Буцаалт',
  damage: 'Гэмтэл',
  loss: 'Алдагдал',
  correction: 'Тооллогын засвар',
}

/** How a reason treats the entered quantity: add it, subtract it, or set the count to it. */
export const STOCK_REASON_MODE: Record<ManualStockReason, 'add' | 'remove' | 'set'> = {
  receipt: 'add',
  return: 'add',
  damage: 'remove',
  loss: 'remove',
  correction: 'set',
}

export const MANUAL_STOCK_REASON_OPTIONS = MANUAL_STOCK_REASONS.map((reason) => ({
  value: reason,
  label: STOCK_REASON_LABELS[reason],
}))
