import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, type Ticket } from './db/db'
import { formatPrice } from './lib/format'
import { DbNotice } from './components/DbNotice'
import { EMPTY_FILTER, matches, SearchPanel, type Filter } from './components/SearchPanel'
import { Sky } from './components/Sky'
import { Starfield } from './components/Starfield'
import { TicketDetail } from './components/TicketDetail'
import { TicketForm } from './components/TicketForm'
import { ToastProvider } from './components/Toast'
import { UpdateToast } from './components/UpdateToast'

type Editing = { ticket?: Ticket } | null

export function App() {
  const tickets = useLiveQuery(() => db.tickets.orderBy('date').reverse().toArray(), [])
  const [opened, setOpened] = useState<{ id: string; from?: DOMRect } | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [searching, setSearching] = useState(false)
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

  const total = tickets?.reduce((sum, t) => sum + (t.price ?? 0), 0) ?? 0
  const oldest = tickets?.[tickets.length - 1]?.date.slice(0, 4)

  return (
    <ToastProvider>
      <Starfield />

      <header className={`app-header${searching ? ' is-searching' : ''}`}>
        <p className="app-header__eyebrow">Keeping Gem</p>
        <h1 className="app-header__title">추억의 밤하늘</h1>
        {tickets && tickets.length > 0 && (
          <p className="app-header__stats">
            {oldest}년부터 별 {tickets.length}개{total > 0 && ` · ${formatPrice(total)}어치의 추억`}
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
        {visible && visible.length > 0 && (
          <Sky tickets={visible} onOpen={(ticket, from) => setOpened({ id: ticket.id, from })} />
        )}
      </main>

      <nav className="dock">
        <button className="dock__btn" onClick={shootingStar} disabled={!visible?.length}>
          <span className="dock__icon dock__icon--comet" aria-hidden="true" />
          별똥별
        </button>
        <button
          className={`dock__btn${searching ? ' is-active' : ''}`}
          onClick={() => setSearching(true)}
          disabled={!tickets?.length}
          aria-pressed={searching}
        >
          <svg className="dock__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 20 20" />
          </svg>
          찾기
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
          onClose={() => setOpened(null)}
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

      <UpdateToast />
      <DbNotice />
    </ToastProvider>
  )
}
