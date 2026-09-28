import { useMemo, type CSSProperties } from 'react'
import type { Ticket } from '@/db/db'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { categoryOf } from '@/lib/categories'
import { formatMoney } from '@/lib/currencies'
import { formatDate } from '@/lib/format'
import { barcodeBars, seeded } from '@/lib/seed'

/*
 * 영수증 스킨의 홈 — 클립에 물린 카드가 쌓인 벽.
 *
 * 티켓 한 장이 영수증 한 장이고, 그날의 포스터가 클립에 물려 그 위에 얹힌다.
 * 기울기는 티켓 id로 정해 늘 같은 각도로 꽂혀 있게 한다(밤하늘의 별자리와 같은 약속).
 *
 * 카드 높이는 제목과 한마디 길이에 따라 제각각이라, 줄을 맞춰 놓으면 짧은 카드 아래가 텅 빈다.
 * 그래서 칸마다 따로 쌓아 빈자리를 없앤다.
 *
 * 다만 '낮은 칸부터 채우기'는 쓰지 않는다 — 첫 카드가 길면 셋째 카드까지 오른쪽으로 가 버려
 * 왼쪽이 비고 읽는 순서가 헝클어진다. 왼·오를 번갈아 놓으면 첫 장은 늘 왼쪽 위에 오고
 * 왼쪽→오른쪽, 최신→과거 순서가 눈에 보이는 대로 이어진다.
 */
const COLUMNS = 2
interface WallProps {
  tickets: Ticket[]
  onOpen: (ticket: Ticket, from: DOMRect) => void
}

export function Wall({ tickets, onOpen }: WallProps) {
  const years = useMemo(() => {
    const groups = new Map<string, Ticket[]>()
    for (const ticket of tickets) {
      const year = ticket.date.slice(0, 4)
      groups.set(year, [...(groups.get(year) ?? []), ticket])
    }
    return [...groups.entries()]
  }, [tickets])

  return (
    <div className="wall">
      {years.map(([year, list]) => (
        <section key={year} className="wall__year">
          <h2 className="wall__band">
            <b>{year}</b>
            <i aria-hidden="true" />
            <span>{list.length}장</span>
          </h2>
          <Masonry tickets={list} onOpen={onOpen} />
        </section>
      ))}
    </div>
  )
}

/** 카드를 왼·오 번갈아 담는다. 칸 안에서는 위에서 아래로 쌓인다. */
function Masonry({ tickets, onOpen }: WallProps) {
  const columns = useMemo(() => {
    const cols: Ticket[][] = Array.from({ length: COLUMNS }, () => [])
    tickets.forEach((ticket, i) => cols[i % COLUMNS].push(ticket))
    return cols
  }, [tickets])

  return (
    <div className="wall__grid">
      {columns.map((column, i) => (
        <div className="wall__col" key={i}>
          {column.map((ticket) => (
            <Card key={ticket.id} ticket={ticket} onOpen={onOpen} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Card({ ticket, onOpen }: { ticket: Ticket; onOpen: (ticket: Ticket, from: DOMRect) => void }) {
  const url = useObjectUrl(ticket.thumb)
  const category = categoryOf(ticket.category)
  // 꽂힌 각도는 티켓마다 다르지만 늘 같다
  const tilt = useMemo(() => (seeded(ticket.id)() * 6 - 3).toFixed(2), [ticket.id])

  return (
    <button
      className="clip"
      style={{ '--tilt': `${tilt}deg` } as CSSProperties}
      onClick={(e) => onOpen(ticket, e.currentTarget.getBoundingClientRect())}
      aria-label={`${ticket.title} 티켓 보기`}
    >
      <span className="clip__poster">
        {url ? <img src={url} alt="" loading="lazy" /> : <span className="clip__blank">{category.label}</span>}
      </span>
      <Paperclip />

      <span className="clip__note">
        {/* 포스터 옆 빈 자리에 세로로 찍히는 종류 */}
        <span className="clip__mark">{category.label}</span>
        <strong className="clip__title">{ticket.title}</strong>
        {ticket.memo && <span className="clip__memo">{ticket.memo}</span>}
        <span className="clip__rule" aria-hidden="true" />
        <span className="clip__at">
          {ticket.venue && (
            <>
              {ticket.venue}
              <br />
            </>
          )}
          {formatDate(ticket.date).slice(5)}
          {ticket.time ? ` ${ticket.time}` : ''}
        </span>
        <span className="clip__foot">
          <Barcode seed={ticket.id} />
          {ticket.price != null && <b>{formatMoney(ticket.price, ticket.currency)}</b>}
        </span>
      </span>
    </button>
  )
}

/** 포스터를 영수증에 물고 있는 클립 */
function Paperclip() {
  return (
    <svg className="clip__wire" viewBox="0 0 40 96" aria-hidden="true">
      <defs>
        <linearGradient id="clip-wire" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdfdfd" />
          <stop offset="0.35" stopColor="#b9bcc2" />
          <stop offset="0.6" stopColor="#f2f3f5" />
          <stop offset="1" stopColor="#8d9199" />
        </linearGradient>
      </defs>
      <path d="M12 86V20a8 8 0 0 1 16 0v58a14 14 0 0 1-28 0V26" stroke="url(#clip-wire)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M20 78V28" stroke="url(#clip-wire)" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** 티켓마다 모양이 다른 바코드. 읽히는 바코드는 아니고 장식이다. */
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => barcodeBars(seed), [seed])

  return (
    <svg className="clip__code" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={40} />
      ))}
    </svg>
  )
}
