export const CATEGORIES = [
  { id: 'concert', label: '콘서트', glow: '255 150 110' },
  { id: 'fanmeeting', label: '팬미팅', glow: '255 175 200' },
  { id: 'musical', label: '뮤지컬', glow: '240 120 190' },
  { id: 'play', label: '연극', glow: '200 150 255' },
  { id: 'movie', label: '영화', glow: '120 170 255' },
  { id: 'exhibition', label: '전시', glow: '120 220 200' },
  { id: 'sports', label: '스포츠', glow: '140 220 120' },
  { id: 'festival', label: '페스티벌', glow: '255 205 100' },
  { id: 'etc', label: '기타', glow: '210 210 230' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const categoryOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
