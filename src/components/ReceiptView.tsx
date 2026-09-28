import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Ticket } from '@/db/db'
import { categoryOf } from '@/lib/categories'
import { formatMoney } from '@/lib/currencies'
import { formatDate } from '@/lib/format'

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
  /** 포스터 옆 빈 자리에 놓을 것 (그날의 사진 단추) */
  aside?: ReactNode
}

export function ReceiptView({ ticket, posterUrl, onPosterOpen, onVenueOpen, aside }: ReceiptViewProps) {
  const category = categoryOf(ticket.category)

  return (
    <article className="rc">
      {/* 위는 곧게 자른 끝, 아래만 뜯긴 자국 — 포스터가 걸친 윗변이 어지럽지 않게 */}
      <div className="rc__body">
        {/* 포스터 옆 빈 자리에 세로로 찍히는 종류 — 홈 카드와 같은 인쇄 */}
        <p className="rc__mark">{category.label}</p>

        <div className="rc__photo">
          {/* 포스터가 오른쪽을 채우고 남는 왼쪽 자리 — 종류와 그날의 사진이 세로로 놓인다 */}
          {aside}
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

        {/*
         * 바코드도 일련번호도 두지 않는다 — 읽히지 않는 장식이라 종이만 빽빽해진다.
         * (밤하늘 티켓도 같은 이유로 화면에서는 반권을 뺐다. 저장 이미지에는 그대로 들어간다)
         */}
        <div className="rc__rule rc__rule--solid" aria-hidden="true" />
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
