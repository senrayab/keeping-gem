import { useLiveQuery } from 'dexie-react-hooks'
import type { CSSProperties } from 'react'
import { db, deleteTicket, type Ticket } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { TicketView } from './TicketView'
import { useToast } from './Toast'

interface TicketDetailProps {
  ticket: Ticket
  /** 누른 별의 자리. 티켓이 그 별에서 펼쳐져 나온다. */
  from?: DOMRect
  onEdit: () => void
  onClose: () => void
}

export function TicketDetail({ ticket, from, onEdit, onClose }: TicketDetailProps) {
  useBackClose(onClose)
  const poster = useLiveQuery(() => db.posters.get(ticket.id), [ticket.id])
  // 본체를 읽는 동안에는 작은 포스터를 먼저 보여준다
  const posterUrl = useObjectUrl(poster?.blob ?? ticket.thumb)
  const toast = useToast()

  // 화면 가운데를 기준으로 별이 있던 곳까지의 거리
  const origin = from
    ? {
        '--from-x': `${from.left + from.width / 2 - window.innerWidth / 2}px`,
        '--from-y': `${from.top + from.height / 2 - window.innerHeight / 2}px`,
      }
    : {}

  const remove = async () => {
    if (!window.confirm(`'${ticket.title}' 티켓을 삭제할까요?`)) return
    await deleteTicket(ticket.id)
    onClose()
    toast('별 하나를 떠나보냈어요.')
  }

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={`${ticket.title} 티켓`} onClick={onClose}>
      <div className="detail__scroll">
        <div className="detail__ticket" style={origin as CSSProperties} onClick={(e) => e.stopPropagation()}>
          <TicketView ticket={ticket} posterUrl={posterUrl} />
        </div>
        <div className="detail__actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn--ghost" onClick={() => void remove()}>
            삭제
          </button>
          <button className="btn btn--ghost" onClick={onEdit}>
            수정
          </button>
          <button className="btn btn--light" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
