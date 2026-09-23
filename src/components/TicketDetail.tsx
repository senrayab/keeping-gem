import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type CSSProperties } from 'react'
import { db, deleteTicket, type Ticket } from '@/db/db'
import { AlbumView } from './AlbumView'
import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { canShareFiles, download, isShareCancel } from '@/lib/download'
import { renderTicketImage, ticketFileName } from '@/lib/ticketImage'
import { ConfirmDialog } from './ConfirmDialog'
import { MapViewer } from './MapViewer'
import { PosterViewer } from './PosterViewer'
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
  useScrollLock()
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
  const [posterOpen, setPosterOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  // 이 티켓에 이어 둔 사진첩 (보관함에서 만들 때 티켓을 고르면 생긴다)
  const album = useLiveQuery(async () => (await db.albums.where('ticketId').equals(ticket.id).first()) ?? null, [ticket.id])
  const photoCount = useLiveQuery(
    async () => (album ? await db.photos.where('albumId').equals(album.id).count() : 0),
    [album?.id],
  )

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

  const [confirming, setConfirming] = useState(false)

  const remove = async () => {
    setConfirming(false)
    await deleteTicket(ticket.id)
    onClose()
    toast('별 하나를 떠나보냈어요.')
  }

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={`${ticket.title} 티켓`} onClick={onClose}>
      <div className="detail__stage">
        <div className="detail__ticket" style={origin as CSSProperties} onClick={(e) => e.stopPropagation()}>
          <TicketView
            ticket={ticket}
            posterUrl={posterUrl}
            onPosterOpen={() => setPosterOpen(true)}
            onVenueOpen={() => setMapOpen(true)}
          />
        </div>
      </div>

      {/* 스크롤하지 않아도 늘 보이도록 아래에 붙인 버튼 줄 */}
      <nav className="detail__actions" aria-label="티켓 동작" onClick={(e) => e.stopPropagation()}>
        <button className="action action--primary" disabled={!image} onClick={save}>
          <Icon d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" />
          {image ? '이미지 저장' : '만드는 중…'}
        </button>
        {shareable && (
          <button className="action" onClick={() => void share()}>
            <Icon d="M12 15V4m0 0L8 8m4-4 4 4M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" />
            공유
          </button>
        )}
        {album && (
          <button className="action" onClick={() => setAlbumOpen(true)}>
            <Icon d="M4.5 7.5h4l1.5-2h4l1.5 2h4v11h-15zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            사진 {photoCount ?? 0}
          </button>
        )}
        <button className="action" onClick={onEdit}>
          <Icon d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
          수정
        </button>
        <button className="action" onClick={() => setConfirming(true)}>
          <Icon d="M5 7h14M10 11v6m4-6v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7" />
          삭제
        </button>
        <button className="action" onClick={onClose}>
          <Icon d="M6 6l12 12M18 6 6 18" />
          닫기
        </button>
      </nav>

      {confirming && (
        <ConfirmDialog
          title="이 티켓을 삭제할까요?"
          message={`'${ticket.title}'과 포스터가 함께 지워져요. 되돌릴 수 없어요.`}
          danger
          confirmLabel="삭제"
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(false)}
        />
      )}

      {albumOpen && album && (
        <AlbumView
          album={album}
          onAdd={() => {}}
          onEdit={() => {}}
          readOnly
          onClose={() => setAlbumOpen(false)}
        />
      )}

      {mapOpen && ticket.lat != null && ticket.lng != null && (
        <MapViewer
          venue={ticket.venue ?? ''}
          address={ticket.address}
          lat={ticket.lat}
          lng={ticket.lng}
          onClose={() => setMapOpen(false)}
        />
      )}

      {posterOpen && posterUrl && (
        <PosterViewer url={posterUrl} title={ticket.title} onClose={() => setPosterOpen(false)} />
      )}
    </div>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
