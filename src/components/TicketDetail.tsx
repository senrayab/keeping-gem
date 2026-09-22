import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type CSSProperties } from 'react'
import { db, deleteTicket, type Ticket } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { canShareFiles, download, isShareCancel } from '@/lib/download'
import { renderTicketImage, ticketFileName } from '@/lib/ticketImage'
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
  // undefined: 읽는 중, null: 포스터 없음
  const poster = useLiveQuery(async () => (await db.posters.get(ticket.id)) ?? null, [ticket.id])
  // 본체를 읽는 동안에는 작은 포스터를 먼저 보여준다
  const posterUrl = useObjectUrl(poster?.blob ?? ticket.thumb)
  const toast = useToast()

  /*
   * 공유할 이미지는 상세보기가 열리자마자 미리 그려 둔다.
   * 안드로이드는 '누른 직후 몇 초 안'에만 공유 시트를 열어 주므로,
   * 누르고 나서 그리기 시작하면 시트가 안 뜰 수 있다.
   */
  const [image, setImage] = useState<File | null>(null)
  useEffect(() => {
    if (poster === undefined) return
    let alive = true
    setImage(null)
    renderTicketImage(ticket, poster?.blob)
      .then((blob) => {
        if (alive) setImage(new File([blob], ticketFileName(ticket), { type: 'image/png' }))
      })
      .catch((e) => console.error(e))
    return () => {
      alive = false
    }
  }, [ticket, poster])

  const shareable = image !== null && canShareFiles(image)

  const share = async () => {
    if (!image) return
    try {
      await navigator.share({ files: [image], title: ticket.title })
    } catch (e) {
      if (!isShareCancel(e)) toast('공유하지 못했어요. 이미지 저장을 써 주세요.')
    }
  }

  const save = () => {
    if (!image) return
    download(image, image.name)
    toast('티켓 이미지를 저장했어요.')
  }

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
          <div className="detail__share">
            <button className="btn btn--glow" disabled={!image} onClick={save}>
              {image ? '이미지 저장' : '이미지 만드는 중…'}
            </button>
            {shareable && (
              <button className="btn btn--light" onClick={() => void share()}>
                공유하기
              </button>
            )}
          </div>
          <div className="detail__row">
            <button className="btn btn--ghost" onClick={() => void remove()}>
              삭제
            </button>
            <button className="btn btn--ghost" onClick={onEdit}>
              수정
            </button>
            <button className="btn btn--ghost" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
