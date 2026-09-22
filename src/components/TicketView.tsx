import type { CSSProperties } from 'react'
import type { Ticket } from '@/db/db'
import { categoryOf } from '@/lib/categories'
import { formatDate, formatPrice } from '@/lib/format'
// barcodeBars는 저장 이미지(lib/ticketImage.ts)와, 아래 주석 처리된 Barcode가 쓴다
import { ticketNumber } from '@/lib/seed'

/**
 * 상세보기의 티켓 한 장.
 *
 * 포스터 → 공연 정보 → 절취선 → 좌석·금액 → 절취선 → 홀로그램 반권 순으로 쌓는다.
 * 조각마다 모서리에 반원 홈을 파서(mask), 이어 붙이면 절취선 양 끝에 둥근 구멍이 생긴다.
 */
interface TicketViewProps {
  ticket: Ticket
  posterUrl?: string
  /** 있으면 포스터를 눌러 크게 볼 수 있다. 화면에서는 포스터를 잘라 짧게 보여주기 때문이다. */
  onPosterOpen?: () => void
}

export function TicketView({ ticket, posterUrl, onPosterOpen }: TicketViewProps) {
  const category = categoryOf(ticket.category)
  const glow = ticket.glow ?? category.glow
  const number = ticketNumber(ticket.id, ticket.date)

  return (
    <article className="ticket" style={{ '--glow': glow } as CSSProperties}>
      <div className="tk-part tk-part--bottom">
        {posterUrl ? (
          <button
            type="button"
            className="ticket__poster-btn"
            onClick={onPosterOpen}
            disabled={!onPosterOpen}
            aria-label={`${ticket.title} 포스터 크게 보기`}
          >
            <img className="ticket__poster" src={posterUrl} alt={`${ticket.title} 포스터`} />
            {onPosterOpen && <span className="ticket__poster-hint">크게 보기</span>}
          </button>
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
        {/*
         * 바코드는 뜻이 없는 장식이라 화면에서는 숨긴다 — 상세보기를 한 화면에 담기 위해.
         * 저장·공유하는 이미지에는 그대로 들어간다(lib/ticketImage.ts).
         * 되살리려면 아래 주석을 풀고 Barcode 함수의 주석도 함께 푼다.
         */}
        {/* <Barcode seed={ticket.id} /> */}
        <div className="ticket__stub-row">
          <span>{number}</span>
          <span>ADMIT ONE</span>
        </div>
      </div>
    </article>
  )
}

// /** 티켓마다 모양이 다른 바코드. 읽히는 바코드는 아니고 장식이다. */
// function Barcode({ seed }: { seed: string }) {
//   const bars = useMemo(() => barcodeBars(seed), [seed])
//
//   return (
//     <svg className="ticket__barcode" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
//       {bars.map((bar) => (
//         <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={40} />
//       ))}
//     </svg>
//   )
// }
