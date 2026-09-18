import { CATEGORY_STATUSES, type CategoryStatus } from '@shop-38/contracts'

export const CATEGORY_STATUS_LABELS: Record<CategoryStatus, string> = {
  active: 'Идэвхтэй',
  inactive: 'Идэвхгүй',
}

export const CATEGORY_STATUS_OPTIONS = CATEGORY_STATUSES.map((status) => ({
  value: status,
  label: CATEGORY_STATUS_LABELS[status],
}))
