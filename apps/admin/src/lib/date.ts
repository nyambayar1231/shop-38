/**
 * Timestamps as staff read them: `2026.09.30 14:05`, Ulaanbaatar time. Built on
 * `en-CA` because it gives ISO-ordered digits; browsers ship little or no `mn`
 * locale data, and Intl would quietly fall back to English month names.
 */
const DATE_TIME = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ulaanbaatar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const formatDateTime = (value: string | Date) =>
  DATE_TIME.format(new Date(value)).replace(',', '').replaceAll('-', '.')
