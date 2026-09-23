import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db, type Ticket } from './db/db'
import { sumByCurrency } from './lib/currencies'
import { BackupSheet } from './components/BackupSheet'
import { DbNotice } from './components/DbNotice'
import { EMPTY_FILTER, matches, SearchPanel, type Filter } from './components/SearchPanel'
import { Sky } from './components/Sky'
import { Starfield } from './components/Starfield'
import { TicketDetail } from './components/TicketDetail'
import { TicketForm } from './components/TicketForm'
import { TicketList } from './components/TicketList'
import { ToastProvider } from './components/Toast'
import { UpdateToast } from './components/UpdateToast'

type Editing = { ticket?: Ticket } | null

const VIEW_KEY = 'keeping-gem:view'

export function App() {
  const tickets = useLiveQuery(() => db.tickets.orderBy('date').reverse().toArray(), [])
  const [opened, setOpened] = useState<{ id: string; from?: DOMRect } | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [searching, setSearching] = useState(false)
  const [vault, setVault] = useState(false)
  // 보던 방식(밤하늘/리스트)은 기기에 기억해 둔다
  const [view, setView] = useState<'sky' | 'list'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'sky'
    } catch {
      return 'sky'
    }
  })
  const toggleView = () => {
    const next = view === 'sky' ? 'list' : 'sky'
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // 기억하지 못해도 보는 데는 지장이 없다
    }
  }
  // 상세보기를 닫고 돌아왔을 때 잠깐 밝혀 둘 별
  const [returning, setReturning] = useState<string | null>(null)
  useEffect(() => {
    if (!returning) return
    const timer = window.setTimeout(() => setReturning(null), 1500)
    return () => window.clearTimeout(timer)
  }, [returning])
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER)

  const filtering = searching && (filter.query.trim() !== '' || filter.category !== 'all')
  const visible = useMemo(
    () => (tickets && filtering ? tickets.filter((t) => matches(t, filter)) : tickets),
    [tickets, filter, filtering],
  )

  // 고친 뒤에도 최신 내용으로 보이도록 id로 다시 찾는다
  const openedTicket = opened && tickets?.find((t) => t.id === opened.id)

  // 찾는 중이면 찾은 별 가운데서 고른다
  const shootingStar = () => {
    if (!visible?.length) return
    const pick = visible[Math.floor(Math.random() * visible.length)]
    setOpened({ id: pick.id })
  }

  const total = sumByCurrency(tickets ?? [])
  const oldest = tickets?.[tickets.length - 1]?.date.slice(0, 4)

  return (
    <ToastProvider>
      <Starfield />

      <header className={`app-header${searching ? ' is-searching' : ''}`}>
        <div className="app-header__actions">
          <button
            className="app-header__icon"
            onClick={toggleView}
            aria-label={view === 'sky' ? '리스트로 보기' : '밤하늘로 보기'}
          >
            {view === 'sky' ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.7L12 16.8 10.4 12.3 6 10.6 10.4 9 12 4.5Z" />
                <circle cx="18" cy="17.5" r="1.4" />
                <circle cx="6.5" cy="17" r="1" />
              </svg>
            )}
          </button>
          <button className="app-header__icon" onClick={() => setVault(true)} aria-label="보관함 (백업·복원)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="4" width="17" height="5" rx="1.5" />
              <path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" />
            </svg>
          </button>
        </div>
        <p className="app-header__eyebrow">Keeping Gem</p>
        <h1 className="app-header__title">추억의 밤하늘</h1>
        {tickets && tickets.length > 0 && (
          <p className="app-header__stats">
            {oldest}년부터 별 {tickets.length}개
            {total && <span className="app-header__spend"> · {total}</span>}
          </p>
        )}
      </header>

      {searching && tickets && (
        <SearchPanel
          tickets={tickets}
          filter={filter}
          onChange={setFilter}
          onClose={() => {
            setSearching(false)
            setFilter(EMPTY_FILTER)
          }}
        />
      )}

      <main className={`app-main${searching ? ' is-searching' : ''}`}>
        {tickets && tickets.length === 0 && (
          <div className="empty">
            <span className="empty__star" aria-hidden="true" />
            <p>
              아직 하늘이 비어 있어요.
              <br />첫 티켓을 별로 띄워 볼까요?
            </p>
          </div>
        )}
        {filtering && visible && (
          <p className="search__result">
            {visible.length > 0 ? `${visible.length}개의 별을 찾았어요` : '맞는 별이 없어요. 다른 말로 찾아볼까요?'}
          </p>
        )}
        {visible &&
          visible.length > 0 &&
          (view === 'sky' ? (
            <Sky tickets={visible} returning={returning} onOpen={(ticket, from) => setOpened({ id: ticket.id, from })} />
          ) : (
            <TicketList tickets={visible} onOpen={(ticket, from) => setOpened({ id: ticket.id, from })} />
          ))}
      </main>

      <nav className="dock">
        <button className="dock__btn" onClick={shootingStar} disabled={!visible?.length}>
          <span className="dock__icon dock__icon--comet" aria-hidden="true" />
          별똥별
        </button>
        <button
          className={`dock__btn dock__btn--icon${searching ? ' is-active' : ''}`}
          onClick={() => setSearching(true)}
          disabled={!tickets?.length}
          aria-label="찾기"
          aria-pressed={searching}
        >
          <svg className="dock__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 20 20" />
          </svg>
        </button>
        <button className="dock__add" onClick={() => setEditing({})} aria-label="티켓 추가">
          +
        </button>
      </nav>

      {openedTicket && (
        <TicketDetail
          key={openedTicket.id}
          ticket={openedTicket}
          from={opened.from}
          onEdit={() => setEditing({ ticket: openedTicket })}
          onClose={() => {
            setReturning(openedTicket.id)
            setOpened(null)
          }}
        />
      )}

      {editing && (
        <TicketForm
          ticket={editing.ticket}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null)
            // 새로 만든 티켓은 바로 펼쳐 보여준다
            if (!editing.ticket) setOpened({ id })
          }}
        />
      )}

      {vault && <BackupSheet onClose={() => setVault(false)} />}

      <UpdateToast />
      <DbNotice />
    </ToastProvider>
  )
}
