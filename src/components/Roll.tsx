import { useMemo } from 'react'
import type { Ticket } from '@/db/db'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { categoryOf } from '@/lib/categories'
import { formatMoney, sumByCurrency } from '@/lib/currencies'
import { formatDate } from '@/lib/format'
import { barcodeBars } from '@/lib/seed'

/*
 * 영수증 스킨의 리스트 보기 — 한 장의 긴 영수증.
 *
 * 클립 카드 벽(Wall)이 '한 장씩 들여다보는' 화면이라면, 이쪽은 '쭉 훑는' 화면이다.
 * 연도마다 소계가 찍히고 맨 아래에 총합이 온다 — 어느 해에 얼마나 다녔는지가 저절로 보인다.
 */
interface RollProps {
  tickets: Ticket[]
  onOpen: (ticket: Ticket, from: DOMRect) => void
}

export function Roll({ tickets, onOpen }: RollProps) {
  const years = useMemo(() => {
    const groups = new Map<string, Ticket[]>()
    for (const ticket of tickets) {
      const year = ticket.date.slice(0, 4)
      groups.set(year, [...(groups.get(year) ?? []), ticket])
    }
    return [...groups.entries()]
  }, [tickets])

  const total = sumByCurrency(tickets)
  // 영수증 맨 아래 일련번호 — 가장 오래된 티켓부터 가장 최근까지
  const span = tickets.length > 0 ? `${tickets[tickets.length - 1].date.slice(0, 4)}-${tickets[0].date.slice(0, 4)}` : ''

  return (
    <div className="roll">
      <div className="roll__tear roll__tear--top" aria-hidden="true" />
      <div className="roll__body">
        <p className="roll__mark">
          <span>KEEPING GEM</span>
          <span>{span}</span>
        </p>
        <div className="roll__rule" aria-hidden="true" />

        {years.map(([year, list], i) => (
          <section key={year} className="roll__year">
            <h2>
              <b>{year}</b>
              <span>{list.length}장</span>
            </h2>
            {list.map((ticket) => (
              <Line key={ticket.id} ticket={ticket} onOpen={onOpen} />
            ))}
            <p className="roll__sum">
              <span>소계</span>
              <span>{sumByCurrency(list) || '—'}</span>
            </p>
            {i < years.length - 1 && <div className="roll__rule" aria-hidden="true" />}
          </section>
        ))}

        <div className="roll__rule roll__rule--double" aria-hidden="true" />
        <p className="roll__total">
          <span>TOTAL · {tickets.length}장</span>
          <b>{total || '—'}</b>
        </p>
        <div className="roll__rule roll__rule--solid" aria-hidden="true" />

        <div className="roll__foot">
          <Barcode seed={span || 'keeping-gem'} />
          <p>KEEPING_GEM_{span.replace('-', '_')}</p>
        </div>
      </div>
      <div className="roll__tear" aria-hidden="true" />
    </div>
  )
}

function Line({ ticket, onOpen }: { ticket: Ticket; onOpen: (ticket: Ticket, from: DOMRect) => void }) {
  const url = useObjectUrl(ticket.thumb)
  const category = categoryOf(ticket.category)
  const place = [ticket.venue, ticket.seat].filter(Boolean).join(' · ')

  return (
    <button
      className="roll__line"
      onClick={(e) => onOpen(ticket, e.currentTarget.getBoundingClientRect())}
      aria-label={`${ticket.title} 티켓 보기`}
    >
      <span className="roll__poster">
        {url ? <img src={url} alt="" loading="lazy" /> : <span className="roll__blank" aria-hidden="true" />}
      </span>
      <span className="roll__what">
        <strong>{ticket.title}</strong>
        {place && <span className="roll__at">{place}</span>}
        <span className="roll__kind">{category.label}</span>
      </span>
      <span className="roll__pay">
        {ticket.price != null ? formatMoney(ticket.price, ticket.currency) : ''}
        <small>
          {formatDate(ticket.date).slice(5)}
          {ticket.time ? ` ${ticket.time}` : ''}
        </small>
      </span>
    </button>
  )
}

/** 영수증 맨 아래 바코드. 읽히는 바코드는 아니고 장식이다. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => barcodeBars(seed), [seed])

  return (
    <svg className="roll__code" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={40} />
      ))}
    </svg>
  )
}
