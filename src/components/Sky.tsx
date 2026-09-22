import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Ticket } from '@/db/db'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { categoryOf } from '@/lib/categories'
import { sumByCurrency } from '@/lib/currencies'
import { formatShortDate } from '@/lib/format'
import { seeded } from '@/lib/seed'

/*
 * 추억의 밤하늘.
 *
 * 티켓 한 장이 별 하나다. 해마다 하늘이 한 폭씩 있고, 아래로 내려갈수록
 * 오래된 해가 나온다 — 달력처럼 '지난달로 넘기기'를 반복하지 않아도
 * 쭉 내려가기만 하면 처음 모은 별까지 닿는다. 오른쪽 연도 줄로는 한 번에 건너뛴다.
 *
 * 별의 자리는 목록처럼 줄을 맞추지 않고, 티켓마다 정해진 자리에 흩어 둔다.
 * 날짜 순서는 지키므로(위가 최근) 흩어져 있어도 '그해의 흐름'이 읽힌다.
 */

/** 별이 좌우로 번갈아 놓이는 자리(%) — 지그재그로 내려가며 별자리처럼 이어진다 */
const LANES = [26, 64, 40, 70, 30, 58]
const ROW_GAP = 104
const BAND_TOP = 120
const BAND_BOTTOM = 72

const bandHeight = (count: number) => BAND_TOP + (count - 1) * ROW_GAP + 90 + BAND_BOTTOM

interface Placement {
  x: number
  y: number
  size: number
  delay: number
  duration: number
}

function place(ticket: Ticket, index: number): Placement {
  const rand = seeded(ticket.id)
  return {
    x: LANES[index % LANES.length] + (rand() - 0.5) * 10,
    y: BAND_TOP + index * ROW_GAP + (rand() - 0.5) * 24,
    size: 68 + Math.round(rand() * 26),
    delay: -rand() * 8,
    duration: 5 + rand() * 4,
  }
}

interface SkyProps {
  tickets: Ticket[]
  /** 방금 상세보기를 닫은 별 — 잠깐 밝혀 자리를 알려준다 */
  returning?: string | null
  onOpen: (ticket: Ticket, from: DOMRect) => void
}

export function Sky({ tickets, returning, onOpen }: SkyProps) {
  const years = useMemo(() => {
    const groups = new Map<string, Ticket[]>()
    for (const ticket of tickets) {
      const year = ticket.date.slice(0, 4)
      groups.set(year, [...(groups.get(year) ?? []), ticket])
    }
    return [...groups.entries()]
  }, [tickets])

  return (
    <>
      <div className="sky">
        {years.map(([year, list]) => (
          <section
            key={year}
            id={`year-${year}`}
            className="band"
            data-year={year}
            style={{ height: bandHeight(list.length) }}
          >
            <header className="band__head">
              <h2 className="band__year">{year}</h2>
              <span className="band__count">
                {list.length}개의 별
                <YearSpend list={list} />
              </span>
            </header>
            <Constellation list={list} />
            {list.map((ticket, i) => (
              <Star
                key={ticket.id}
                ticket={ticket}
                placement={place(ticket, i)}
                returning={ticket.id === returning}
                onOpen={onOpen}
              />
            ))}
          </section>
        ))}
      </div>
      {years.length > 1 && <YearRail years={years.map(([year]) => year)} />}
    </>
  )
}

/** 그해 티켓 금액의 합. 통화가 섞이면 통화별로 나란히 적는다. */
function YearSpend({ list }: { list: Ticket[] }) {
  const total = sumByCurrency(list)
  return total ? <> · {total}</> : null
}

/** 같은 해의 별을 날짜 순으로 잇는 옅은 선 */
function Constellation({ list }: { list: Ticket[] }) {
  if (list.length < 2) return null
  const points = list.map((ticket, i) => place(ticket, i))
  // 세로는 픽셀 그대로 쓰도록 viewBox 높이를 띠 높이와 맞춘다 — 다르면 선이 별을 비껴간다
  const height = bandHeight(list.length)
  return (
    <svg className="band__lines" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

interface StarProps {
  ticket: Ticket
  placement: Placement
  returning: boolean
  onOpen: (ticket: Ticket, from: DOMRect) => void
}

function Star({ ticket, placement, returning, onOpen }: StarProps) {
  const url = useObjectUrl(ticket.thumb)
  const glow = ticket.glow ?? categoryOf(ticket.category).glow

  const style = {
    left: `${placement.x}%`,
    top: placement.y,
    '--size': `${placement.size}px`,
    '--glow': glow,
    '--delay': `${placement.delay}s`,
    '--duration': `${placement.duration}s`,
  } as CSSProperties

  return (
    <button
      className={`star${returning ? ' is-returning' : ''}`}
      style={style}
      onClick={(e) => onOpen(ticket, e.currentTarget.querySelector('.star__orb')!.getBoundingClientRect())}
      aria-label={`${ticket.title} 티켓 보기`}
    >
      <span className="star__orb">
        {url ? <img src={url} alt="" /> : <span className="star__initial">{ticket.title.slice(0, 1)}</span>}
      </span>
      <span className="star__label">
        <span className="star__title">{ticket.title}</span>
        <span className="star__date">{formatShortDate(ticket.date)}</span>
      </span>
    </button>
  )
}

/** 오른쪽 가장자리의 연도 줄. 보고 있는 해를 밝히고, 누르면 그해로 건너뛴다. */
function YearRail({ years }: { years: string[] }) {
  const [active, setActive] = useState(years[0])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.year ?? '')
        }
      },
      // 화면 한가운데 줄에 걸린 해를 '보고 있는 해'로 친다
      { rootMargin: '-50% 0px -50% 0px' },
    )
    document.querySelectorAll('.band').forEach((band) => observer.observe(band))
    return () => observer.disconnect()
  }, [years])

  return (
    <nav className="rail" aria-label="연도로 이동">
      {years.map((year) => (
        <button
          key={year}
          className={`rail__year${year === active ? ' is-active' : ''}`}
          onClick={() => document.getElementById(`year-${year}`)?.scrollIntoView({ behavior: 'smooth' })}
        >
          {year.slice(2)}
        </button>
      ))}
    </nav>
  )
}
