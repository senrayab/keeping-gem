import type { CSSProperties } from 'react'
import type { Ticket } from '@/db/db'
import { categoryOf } from '@/lib/categories'
import { formatMoney } from '@/lib/currencies'
import { formatDate } from '@/lib/format'
// 일련번호·바코드는 저장 이미지(lib/ticketImage.ts)와 아래 주석 처리된 조각이 쓴다

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
  /** 좌표가 있는 장소라면, 눌러서 지도를 열 수 있다 */
  onVenueOpen?: () => void
}

export function TicketView({ ticket, posterUrl, onPosterOpen, onVenueOpen }: TicketViewProps) {
  const category = categoryOf(ticket.category)
  const glow = ticket.glow ?? category.glow

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
            {/* 포스터 왼쪽 아래를 라벨 크기만큼 파낸 자리 — 파인 자리의 모서리는 모두 둥글다 */}
            <span className="ticket__chip">{category.label}</span>
            {/* 금액은 포스터 오른쪽 위에 보일 듯 말 듯 — 궁금할 때만 눈에 들어오면 된다 */}
            {ticket.price != null && <span className="ticket__price">{formatMoney(ticket.price, ticket.currency)}</span>}
            {onPosterOpen && <span className="ticket__poster-hint">크게 보기</span>}
          </button>
        ) : (
          <div className="ticket__poster ticket__poster--empty">
            <span>{ticket.title}</span>
            <span className="ticket__chip">{category.label}</span>
            {ticket.price != null && <span className="ticket__price">{formatMoney(ticket.price, ticket.currency)}</span>}
          </div>
        )}
        <div className="ticket__head">
          <h2 className="ticket__title">{ticket.title}</h2>
          {ticket.venue &&
            (onVenueOpen && ticket.lat != null ? (
              <button type="button" className="ticket__venue ticket__venue--map" onClick={onVenueOpen}>
                {ticket.venue}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </button>
            ) : (
              <p className="ticket__venue">{ticket.venue}</p>
            ))}
        </div>
      </div>

      <div className="tk-part tk-part--top">
        <dl className="ticket__grid">
          <div>
            <dt>DATE</dt>
            <dd>{formatDate(ticket.date)}</dd>
          </div>
          <div>
            <dt>TIME</dt>
            <dd>{ticket.time ?? '—'}</dd>
          </div>
          {/* 좌석은 '1층 A구역 12열 7번'처럼 길다 — 금액을 포스터 위로 올리고 한 줄을 다 준다 */}
          <div className="ticket__wide">
            <dt>SEAT</dt>
            <dd>{ticket.seat || '—'}</dd>
          </div>
        </dl>
        {ticket.memo && <p className="ticket__memo">{ticket.memo}</p>}
      </div>

      {/*
       * 홀로그램 반권(일련번호·ADMIT ONE·바코드)은 뜻이 없는 장식이라 화면에서는 두지 않는다.
       * 마지막 조각은 아래를 둥글게 마감한다. 저장·공유 이미지에는 반권이 그대로 들어간다
       * (lib/ticketImage.ts). 되살리려면 아래 주석을 푼다.
       */}
      {/*
      <div className="tk-part tk-part--top ticket__stub">
        <Barcode seed={ticket.id} />
        <div className="ticket__stub-row">
          <span>{number}</span>
          <span>ADMIT ONE</span>
        </div>
      </div>
      */}
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
