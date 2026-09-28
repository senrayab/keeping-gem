import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
 * 그래서 벽돌 쌓기로 채운다 — 앞에서부터 그때그때 낮은 칸에 놓는다(사진첩과 같은 방식).
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

/**
 * 카드를 두 칸에 나눠 담는다.
 *
 * 높이는 글자 수에 따라 달라지므로 한 번 그린 뒤 실제 높이를 재서 다시 나눈다.
 * (화면에 칠해지기 전에 재고 다시 나누므로 깜빡이지 않는다)
 */
function Masonry({ tickets, onOpen }: WallProps) {
  const host = useRef<HTMLDivElement>(null)
  const [heights, setHeights] = useState<Map<string, number>>(new Map())

  const measure = () => {
    const nodes = host.current?.querySelectorAll<HTMLElement>('[data-ticket]')
    if (!nodes) return
    const next = new Map<string, number>()
    for (const node of nodes) next.set(node.dataset.ticket!, node.offsetHeight)
    setHeights((prev) => {
      if (prev.size === next.size && [...next].every(([id, h]) => prev.get(id) === h)) return prev
      return next
    })
  }

  useLayoutEffect(measure)

  // 화면을 돌리면 칸 너비가 달라져 높이도 달라진다
  useEffect(() => {
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const columns = useMemo(() => {
    const cols: Ticket[][] = Array.from({ length: COLUMNS }, () => [])
    const tall = new Array<number>(COLUMNS).fill(0)
    for (const ticket of tickets) {
      const shortest = tall.indexOf(Math.min(...tall))
      cols[shortest].push(ticket)
      // 아직 재 보지 않았으면 다들 같은 키로 치고 번갈아 놓는다
      tall[shortest] += heights.get(ticket.id) ?? 260
    }
    return cols
  }, [tickets, heights])

  return (
    <div className="wall__grid" ref={host}>
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
      data-ticket={ticket.id}
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
