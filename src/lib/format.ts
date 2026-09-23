const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2026-09-22" → "2026.09.22 (화)" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${weekday})`
}

/** "2026-09-22" → "9.22" */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}.${d}`
}

/** 132000 → "132,000원" */
export const formatPrice = (price: number) => `${price.toLocaleString('ko-KR')}원`

/** 오늘 날짜 "YYYY-MM-DD" (기기 시간대 기준) */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "2026-09-12" ~ "2026-09-14" → "2026.09.12 (토) ~ 09.14 (월)" */
export function formatDateRange(from: string, to?: string): string {
  if (!to || to === from) return formatDate(from)
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${formatDate(from)} ~ ${sameYear ? formatDate(to).slice(5) : formatDate(to)}`
}
