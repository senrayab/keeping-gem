import { useEffect, useState } from 'react'

const KEY = 'keeping-gem:ticket-draft'

/**
 * 새 티켓을 쓰는 중인 글자들을 기기에 잠깐 맡겨 둔다.
 * 앱을 닫거나 새로고침해도 다시 열면 이어서 쓸 수 있다. 저장하면 지운다.
 * (포스터는 크기가 커서 맡기지 않는다 — 다시 골라야 한다)
 *
 * 개인 창 등에서는 저장소 접근이 막힐 수 있으므로 실패해도 조용히 넘어간다.
 */
export function useDraft<T extends object>(enabled: boolean, initial: T): [T, (next: Partial<T>) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (!enabled) return initial
    try {
      const saved = localStorage.getItem(KEY)
      return saved ? { ...initial, ...(JSON.parse(saved) as Partial<T>) } : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    if (!enabled) return
    try {
      localStorage.setItem(KEY, JSON.stringify(value))
    } catch {
      // 맡기지 못해도 쓰는 데는 지장이 없다
    }
  }, [enabled, value])

  const update = (next: Partial<T>) => setValue((prev) => ({ ...prev, ...next }))
  const clear = () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      // 위와 같다
    }
  }

  return [value, update, clear]
}
