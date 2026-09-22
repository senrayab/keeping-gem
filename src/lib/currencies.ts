/*
 * 티켓 금액의 통화.
 *
 * 환율로 바꾸지 않는다 — 그날 낸 돈을 그대로 적어 두는 것이 기록으로 맞고,
 * 오늘 환율로 바꾸면 볼 때마다 금액이 달라진다. 합계도 통화별로 따로 낸다.
 */
export const CURRENCIES = [
  { id: 'KRW', symbol: '₩', decimals: 0 },
  { id: 'JPY', symbol: '¥', decimals: 0 },
  { id: 'USD', symbol: '$', decimals: 2 },
  { id: 'EUR', symbol: '€', decimals: 2 },
] as const

export type CurrencyId = (typeof CURRENCIES)[number]['id']

export const DEFAULT_CURRENCY: CurrencyId = 'KRW'

export const currencyOf = (id: CurrencyId | undefined) =>
  CURRENCIES.find((c) => c.id === id) ?? CURRENCIES[0]

/** 123000 → "123,000원" / 13800(JPY) → "¥13,800" / 120.5(USD) → "$120.50" */
export function formatMoney(amount: number, id: CurrencyId = DEFAULT_CURRENCY): string {
  const currency = currencyOf(id)
  const number = amount.toLocaleString('ko-KR', {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  })
  // 원화만 뒤에 '원'을 붙인다 — 한국어에서는 그게 자연스럽다
  return currency.id === 'KRW' ? `${number}원` : `${currency.symbol}${number}`
}

/** 통화가 섞인 티켓들의 합계 — 통화마다 따로 더해 "609,000원 · ¥13,800"처럼 잇는다 */
export function sumByCurrency(items: { price?: number; currency?: CurrencyId }[]): string {
  const totals = new Map<CurrencyId, number>()
  for (const item of items) {
    if (!item.price) continue
    const id = item.currency ?? DEFAULT_CURRENCY
    totals.set(id, (totals.get(id) ?? 0) + item.price)
  }
  // 통화 목록에 적은 순서(원화 먼저)로 보여준다
  return CURRENCIES.filter((c) => totals.has(c.id))
    .map((c) => formatMoney(totals.get(c.id)!, c.id))
    .join(' · ')
}
