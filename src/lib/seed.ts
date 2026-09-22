/**
 * 티켓 id로 늘 같은 난수를 만든다.
 * 별의 자리·크기·반짝이는 박자가 열 때마다 바뀌지 않고 '그 별의 자리'로 남게 한다.
 */
export function seeded(key: string): () => number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // mulberry32
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 티켓에 찍히는 일련번호. 같은 티켓이면 늘 같은 번호다. */
export function ticketNumber(id: string, date: string): string {
  const rand = seeded(id)
  const tail = Array.from({ length: 6 }, () => Math.floor(rand() * 10)).join('')
  return `KG${date.replaceAll('-', '')}${tail}`
}
