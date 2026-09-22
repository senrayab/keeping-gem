import { useEffect, useRef } from 'react'
import type { Ticket } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { CATEGORIES, type CategoryId } from '@/lib/categories'

export interface Filter {
  query: string
  category: CategoryId | 'all'
}

export const EMPTY_FILTER: Filter = { query: '', category: 'all' }

/** 제목·장소·좌석·한마디에서 찾는다. 띄어쓰기와 대소문자는 가리지 않는다. */
export function matches(ticket: Ticket, { query, category }: Filter): boolean {
  if (category !== 'all' && ticket.category !== category) return false
  const q = query.replace(/\s+/g, '').toLowerCase()
  if (!q) return true
  const haystack = [ticket.title, ticket.venue, ticket.seat, ticket.memo, ticket.date]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, '')
    .toLowerCase()
  return haystack.includes(q)
}

interface SearchPanelProps {
  tickets: Ticket[]
  filter: Filter
  onChange: (filter: Filter) => void
  onClose: () => void
}

/**
 * 밤하늘 위에 붙는 찾기 막대. 고른 조건에 맞는 별만 하늘에 남는다.
 * 종류 칩에는 그 종류의 별이 몇 개인지 같이 적어, 누르기 전에 가늠할 수 있게 한다.
 */
export function SearchPanel({ tickets, filter, onChange, onClose }: SearchPanelProps) {
  useBackClose(onClose)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const counts = new Map<string, number>()
  for (const t of tickets) counts.set(t.category, (counts.get(t.category) ?? 0) + 1)
  const present = CATEGORIES.filter((c) => counts.has(c.id))

  return (
    <div className="search">
      <div className="search__bar">
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="제목, 장소, 좌석, 한마디로 찾기"
          aria-label="티켓 찾기"
        />
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          닫기
        </button>
      </div>
      <div className="search__chips" role="group" aria-label="종류로 골라 보기">
        <button
          type="button"
          className={`chip${filter.category === 'all' ? ' is-active' : ''}`}
          onClick={() => onChange({ ...filter, category: 'all' })}
        >
          전체 <small>{tickets.length}</small>
        </button>
        {present.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`chip${filter.category === c.id ? ' is-active' : ''}`}
            onClick={() => onChange({ ...filter, category: c.id })}
          >
            {c.label} <small>{counts.get(c.id)}</small>
          </button>
        ))}
      </div>
    </div>
  )
}
