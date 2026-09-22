import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type Ticket } from './db/db'
import { formatPrice } from './lib/format'
import { DbNotice } from './components/DbNotice'
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

  // 고친 뒤에도 최신 내용으로 보이도록 id로 다시 찾는다
  const openedTicket = opened && tickets?.find((t) => t.id === opened.id)

  const shootingStar = () => {
    if (!tickets?.length) return
    const pick = tickets[Math.floor(Math.random() * tickets.length)]
    setOpened({ id: pick.id })
  }

  const total = tickets?.reduce((sum, t) => sum + (t.price ?? 0), 0) ?? 0
  const oldest = tickets?.[tickets.length - 1]?.date.slice(0, 4)

  return (
    <ToastProvider>
      <Starfield />

      <header className="app-header">
        <p className="app-header__eyebrow">Keeping Gem</p>
        <h1 className="app-header__title">추억의 밤하늘</h1>
        {tickets && tickets.length > 0 && (
          <p className="app-header__stats">
            {oldest}년부터 별 {tickets.length}개{total > 0 && ` · ${formatPrice(total)}어치의 추억`}
          </p>
        )}
      </header>

      <main className="app-main">
        {tickets && tickets.length === 0 && (
          <div className="empty">
            <span className="empty__star" aria-hidden="true" />
            <p>
              아직 하늘이 비어 있어요.
              <br />첫 티켓을 별로 띄워 볼까요?
            </p>
          </div>
        )}
        {tickets && tickets.length > 0 && (
          <Sky tickets={tickets} onOpen={(ticket, from) => setOpened({ id: ticket.id, from })} />
        )}
      </main>

      <nav className="dock">
        <button className="dock__btn" onClick={shootingStar} disabled={!tickets?.length}>
          <span className="dock__icon dock__icon--comet" aria-hidden="true" />
          별똥별
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
