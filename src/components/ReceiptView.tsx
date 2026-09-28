import { MapPin } from 'lucide-react'
import { useMemo } from 'react'
import type { Ticket } from '@/db/db'
import { categoryOf } from '@/lib/categories'
import { formatMoney } from '@/lib/currencies'
import { formatDate } from '@/lib/format'
import { barcodeBars, ticketNumber } from '@/lib/seed'

/**
 * 영수증 스킨의 티켓 한 장.
 *
 * 클립에 물린 포스터 → 제목 → 그날의 한마디 → 점선 → 날짜·좌석·금액 → 바코드 순으로
 * 한 장의 종이에 인쇄된다. 화면은 스크롤하지 않으므로 포스터가 먼저 자리를 양보한다.
 */
interface ReceiptViewProps {
  ticket: Ticket
  posterUrl?: string
  onPosterOpen?: () => void
  onVenueOpen?: () => void
}

export function ReceiptView({ ticket, posterUrl, onPosterOpen, onVenueOpen }: ReceiptViewProps) {
  const category = categoryOf(ticket.category)
  const number = useMemo(() => ticketNumber(ticket.id, ticket.date), [ticket.id, ticket.date])

  return (
    <article className="rc">
      <div className="rc__tear rc__tear--top" aria-hidden="true" />

      <div className="rc__body">
        <p className="rc__mark">
          <span>@ KEEPING_GEM</span>
          <span>{category.label}</span>
        </p>

        <div className="rc__photo">
          <Paperclip />
          {posterUrl ? (
            <button
              type="button"
              className="rc__poster"
              onClick={onPosterOpen}
              disabled={!onPosterOpen}
              aria-label={`${ticket.title} 포스터 크게 보기`}
            >
              <img src={posterUrl} alt={`${ticket.title} 포스터`} />
            </button>
          ) : (
            <span className="rc__poster rc__poster--empty">{category.label}</span>
          )}
        </div>

        <h2 className="rc__title">{ticket.title}</h2>
        {ticket.memo && <p className="rc__memo">{ticket.memo}</p>}

        {ticket.venue &&
          (onVenueOpen && ticket.lat != null ? (
            <button type="button" className="rc__venue rc__venue--map" onClick={onVenueOpen}>
              {ticket.venue}
              <MapPin aria-hidden="true" />
            </button>
          ) : (
            <p className="rc__venue">{ticket.venue}</p>
          ))}

        <div className="rc__rule" aria-hidden="true" />

        <dl className="rc__grid">
          <div>
            <dt>DATE</dt>
            <dd>{formatDate(ticket.date)}</dd>
          </div>
          <div>
            <dt>TIME</dt>
            <dd>{ticket.time ?? '—'}</dd>
          </div>
          <div className="rc__wide">
            <dt>SEAT</dt>
            <dd>{ticket.seat || '—'}</dd>
          </div>
          {ticket.price != null && (
            <div className="rc__wide rc__pay">
              <dt>PRICE</dt>
              <dd>{formatMoney(ticket.price, ticket.currency)}</dd>
            </div>
          )}
        </dl>

        <div className="rc__rule rc__rule--solid" aria-hidden="true" />

        <div className="rc__foot">
          <Barcode seed={ticket.id} />
          <p>{number}</p>
        </div>
      </div>

      <div className="rc__tear" aria-hidden="true" />
    </article>
  )
}

/** 포스터를 종이에 물고 있는 클립 */
function Paperclip() {
  return (
    <svg className="rc__wire" viewBox="0 0 40 96" aria-hidden="true">
      <defs>
        <linearGradient id="rc-wire" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdfdfd" />
          <stop offset="0.35" stopColor="#b9bcc2" />
          <stop offset="0.6" stopColor="#f2f3f5" />
          <stop offset="1" stopColor="#8d9199" />
        </linearGradient>
      </defs>
      <path d="M12 86V20a8 8 0 0 1 16 0v58a14 14 0 0 1-28 0V26" stroke="url(#rc-wire)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M20 78V28" stroke="url(#rc-wire)" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** 티켓마다 모양이 다른 바코드. 읽히는 바코드는 아니고 장식이다. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => barcodeBars(seed), [seed])

  return (
    <svg className="rc__code" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={40} />
      ))}
    </svg>
  )
}
