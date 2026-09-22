import { useMemo, type CSSProperties } from 'react'
import type { Ticket } from '@/db/db'
import { categoryOf } from '@/lib/categories'
import { formatDate, formatPrice } from '@/lib/format'
import { barcodeBars, ticketNumber } from '@/lib/seed'

/**
 * 상세보기의 티켓 한 장.
 *
 * 포스터 → 공연 정보 → 절취선 → 좌석·금액 → 절취선 → 홀로그램 반권 순으로 쌓는다.
 * 조각마다 모서리에 반원 홈을 파서(mask), 이어 붙이면 절취선 양 끝에 둥근 구멍이 생긴다.
 */
export function TicketView({ ticket, posterUrl }: { ticket: Ticket; posterUrl?: string }) {
  const category = categoryOf(ticket.category)
  const glow = ticket.glow ?? category.glow
  const number = ticketNumber(ticket.id, ticket.date)

  return (
    <article className="ticket" style={{ '--glow': glow } as CSSProperties}>
      <div className="tk-part tk-part--bottom">
        {posterUrl ? (
          <img
            className="ticket__poster"
            src={posterUrl}
            alt={`${ticket.title} 포스터`}
            style={{ aspectRatio: ticket.posterRatio ? String(ticket.posterRatio) : undefined }}
          />
        ) : (
          <div className="ticket__poster ticket__poster--empty">
            <span>{ticket.title}</span>
          </div>
        )}
        <div className="ticket__head">
          <span className="ticket__chip">{category.label}</span>
          <h2 className="ticket__title">{ticket.title}</h2>
          {ticket.venue && <p className="ticket__venue">{ticket.venue}</p>}
        </div>
      </div>

      <div className="tk-part tk-part--top tk-part--bottom">
        <dl className="ticket__grid">
          <div>
            <dt>DATE</dt>
            <dd>{formatDate(ticket.date)}</dd>
          </div>
          <div>
            <dt>TIME</dt>
            <dd>{ticket.time ?? '—'}</dd>
          </div>
          <div>
            <dt>SEAT</dt>
            <dd>{ticket.seat || '—'}</dd>
          </div>
          <div>
            <dt>PRICE</dt>
            <dd>{ticket.price != null ? formatPrice(ticket.price) : '—'}</dd>
          </div>
        </dl>
        {ticket.memo && <p className="ticket__memo">{ticket.memo}</p>}
      </div>

      <div className="tk-part tk-part--top ticket__stub">
        <Barcode seed={ticket.id} />
        <div className="ticket__stub-row">
          <span>{number}</span>
          <span>ADMIT ONE</span>
        </div>
      </div>
    </article>
  )
}

/** 티켓마다 모양이 다른 바코드. 읽히는 바코드는 아니고 장식이다. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => barcodeBars(seed), [seed])

  return (
    <svg className="ticket__barcode" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={40} />
      ))}
    </svg>
  )
}
