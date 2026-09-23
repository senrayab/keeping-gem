import { useMemo, type CSSProperties } from 'react'
import type { Ticket } from '@/db/db'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { categoryOf } from '@/lib/categories'
import { formatMoney } from '@/lib/currencies'
import { formatDate } from '@/lib/format'

/*
 * 리스트 보기.
 *
 * 밤하늘은 '흩어진 추억을 거닐게' 하는 화면이라, 무엇이 언제였는지 한눈에 훑기엔 느리다.
 * 그래서 같은 티켓을 가로로 눕힌 표 형태로도 볼 수 있게 한다 — 가운데 절취선을 두고
 * 왼쪽에 포스터, 오른쪽에 날짜·좌석·금액.
 */
interface TicketListProps {
  tickets: Ticket[]
  onOpen: (ticket: Ticket, from: DOMRect) => void
}

export function TicketList({ tickets, onOpen }: TicketListProps) {
  const years = useMemo(() => {
    const groups = new Map<string, Ticket[]>()
    for (const ticket of tickets) {
      const year = ticket.date.slice(0, 4)
      groups.set(year, [...(groups.get(year) ?? []), ticket])
    }
    return [...groups.entries()]
  }, [tickets])

  return (
    <div className="tlist">
      {years.map(([year, list]) => (
        <section key={year} className="tlist__year">
          <h2>
            {year}
            <span>{list.length}개</span>
          </h2>
          {list.map((ticket) => (
            <Row key={ticket.id} ticket={ticket} onOpen={onOpen} />
          ))}
        </section>
      ))}
    </div>
  )
}

function Row({ ticket, onOpen }: { ticket: Ticket; onOpen: (ticket: Ticket, from: DOMRect) => void }) {
  const url = useObjectUrl(ticket.thumb)
  const category = categoryOf(ticket.category)
  const glow = ticket.glow ?? category.glow

  return (
    <button
      className="tlist__item"
      style={{ '--glow': glow } as CSSProperties}
      onClick={(e) => onOpen(ticket, e.currentTarget.getBoundingClientRect())}
      aria-label={`${ticket.title} 티켓 보기`}
    >
      <span className="tlist__poster">
        {url ? <img src={url} alt="" loading="lazy" /> : <span>{ticket.title.slice(0, 1)}</span>}
      </span>
      <span className="tlist__body">
        <span className="tlist__chip">{category.label}</span>
        <strong className="tlist__title">{ticket.title}</strong>
        <span className="tlist__fields">
          <span>
            <em>DATE</em>
            {formatDate(ticket.date)}
            {ticket.time ? ` ${ticket.time}` : ''}
          </span>
          {ticket.venue && (
            <span>
              <em>PLACE</em>
              {ticket.venue}
            </span>
          )}
          {ticket.seat && (
            <span>
              <em>SEAT</em>
              {ticket.seat}
            </span>
          )}
          {ticket.price != null && (
            <span>
              <em>PRICE</em>
              {formatMoney(ticket.price, ticket.currency)}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
