import type { OrderStatus } from '@shop-38/contracts'
import type { Tone } from '@/components/common'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Хүлээгдэж буй',
  completed: 'Биелсэн',
  cancelled: 'Цуцалсан',
}

export const ORDER_STATUS_TONES: Record<OrderStatus, Tone> = {
  pending: 'warn',
  completed: 'ok',
  cancelled: 'dead',
}
