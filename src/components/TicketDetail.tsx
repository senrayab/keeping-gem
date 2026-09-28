import { Download, Images, Pencil, Share2, Trash2, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { db, deleteTicket, type Ticket } from '@/db/db'
import { AlbumView } from './AlbumView'
import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { canShareFiles, download, isShareCancel } from '@/lib/download'
import { renderReceiptImage } from '@/lib/receiptImage'
import { renderTicketImage, ticketFileName } from '@/lib/ticketImage'
import { ConfirmDialog } from './ConfirmDialog'
import { MapViewer } from './MapViewer'
import { PosterViewer } from './PosterViewer'
import { ReceiptView } from './ReceiptView'
import { useTheme } from './Theme'
import { TicketView } from './TicketView'
import { useToast } from './Toast'

/** 옆으로 이만큼 밀면 앞뒤 티켓으로 넘어가고, 위로 이만큼 올리면 닫힌다 */
const SWIPE = 60
const CLOSE = 96

interface TicketDetailProps {
  ticket: Ticket
  /** 지금 보고 있는 목록 (찾는 중이면 찾은 것들). 옆으로 밀 때 앞뒤를 여기서 찾는다. */
  tickets: Ticket[]
  /** 누른 별의 자리. 티켓이 그 별에서 펼쳐져 나온다. */
  from?: DOMRect
  onMove: (id: string) => void
  onEdit: () => void
  onClose: () => void
}

export function TicketDetail({ ticket, tickets, from, onMove, onEdit, onClose }: TicketDetailProps) {
  useBackClose(onClose)
  useScrollLock()
  // undefined: 읽는 중, null: 포스터 없음
  const poster = useLiveQuery(async () => (await db.posters.get(ticket.id)) ?? null, [ticket.id])
  // 본체를 읽는 동안에는 작은 포스터를 먼저 보여준다
  const posterUrl = useObjectUrl(poster?.blob ?? ticket.thumb)
  const toast = useToast()
  // 스킨에 따라 같은 티켓이 별에서 펼쳐진 표가 되기도, 영수증 한 장이 되기도 한다
  const { theme } = useTheme()

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
    // 스킨에 따라 별에서 펼쳐진 티켓으로도, 영수증 한 장으로도 그린다
    const draw = theme === 'receipt' ? renderReceiptImage : renderTicketImage
    draw(ticket, poster?.blob)
      .then((blob) => {
        if (alive) setImage(new File([blob], ticketFileName(ticket), { type: 'image/png' }))
      })
      .catch((e) => console.error(e))
    return () => {
      alive = false
    }
  }, [ticket, poster, theme])

  const shareable = image !== null && canShareFiles(image)
  const [posterOpen, setPosterOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  // 이 티켓에 이어 둔 사진첩 (사진첩을 만들 때 티켓을 고르면 생긴다)
  const album = useLiveQuery(async () => (await db.albums.where('ticketIds').equals(ticket.id).first()) ?? null, [ticket.id])
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

  /*
   * 손짓으로 넘기기.
   *
   * 옆으로 밀면 앞뒤 티켓, 위로 올리면 닫기 — 사진 크게 보기와 같은 약속이다.
   * 처음 움직인 방향으로만 끌리게 해, 넘기다가 닫히는 일이 없도록 한다.
   */
  const index = tickets.findIndex((t) => t.id === ticket.id)
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [enter, setEnter] = useState<'prev' | 'next' | null>(null)
  // 민 방향으로 빠져나가는 중 (그동안 손짓은 받지 않는다)
  const [exit, setExit] = useState<'left' | 'right' | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const axis = useRef<'x' | 'y' | null>(null)
  const swapping = useRef<number>()

  useEffect(() => () => window.clearTimeout(swapping.current), [])

  /*
   * 밀던 손을 떼면 그 방향으로 티켓이 마저 빠져나가고, 다음 티켓이 반대쪽에서 따라 들어온다.
   * 빠져나가는 걸 건너뛰면 민 자리에서 티켓이 사라졌다가 반대쪽에서 튀어나와, 되튄 것처럼 보인다.
   */
  const move = (step: number) => {
    const next = tickets[index + step]
    if (!next || swapping.current) return
    setExit(step > 0 ? 'left' : 'right')
    swapping.current = window.setTimeout(() => {
      swapping.current = undefined
      setEnter(step > 0 ? 'next' : 'prev')
      setExit(null)
      setDrag({ x: 0, y: 0 })
      onMove(next.id)
    }, 170)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (swapping.current) return
    start.current = { x: e.clientX, y: e.clientY }
    moved.current = false
    axis.current = null
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (!moved.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      moved.current = true
      axis.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      /*
       * 민 것이 확실해진 다음에야 손끝을 붙잡는다.
       * 처음부터 붙잡으면 톡 누른 것도 이 자리에서 받아 버려, 포스터·장소 단추가 눌리지 않는다.
       */
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    if (axis.current === 'x') {
      // 앞뒤로 더 없으면 덜 끌린다
      const atEdge = (dx > 0 && index <= 0) || (dx < 0 && index >= tickets.length - 1)
      setDrag({ x: atEdge ? dx * 0.25 : dx, y: 0 })
    } else if (axis.current === 'y') {
      setDrag({ x: 0, y: dy < 0 ? dy : dy * 0.25 })
    }
  }

  const onPointerUp = () => {
    if (axis.current === 'x' && Math.abs(drag.x) > SWIPE) {
      move(drag.x > 0 ? -1 : 1)
      start.current = null
      axis.current = null
      return
    }
    if (axis.current === 'y' && -drag.y > CLOSE) {
      onClose()
      return
    }
    start.current = null
    axis.current = null
    setDrag({ x: 0, y: 0 })
  }

  const [confirming, setConfirming] = useState(false)

  const remove = async () => {
    setConfirming(false)
    await deleteTicket(ticket.id)
    onClose()
    toast(theme === 'receipt' ? '한 장을 덜어냈어요.' : '별 하나를 떠나보냈어요.')
  }

  return (
    <div
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-label={`${ticket.title} 티켓 (${index + 1} / ${tickets.length})`}
      onClick={() => {
        if (!moved.current) onClose()
      }}
    >
      <div
        className="detail__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          key={ticket.id}
          className={`detail__ticket${enter ? ` is-${enter}` : ''}`}
          style={
            {
              ...origin,
              ...(exit
                ? {
                    transform: `translateX(${exit === 'left' ? -110 : 110}%)`,
                    opacity: 0,
                    transition: 'transform 0.2s ease-in, opacity 0.2s ease-in',
                  }
                : {
                    transform: drag.x || drag.y ? `translate(${drag.x}px, ${drag.y}px)` : undefined,
                    opacity: drag.y < 0 ? Math.max(0.4, 1 + drag.y / 320) : undefined,
                    transition: drag.x || drag.y ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
                  }),
            } as CSSProperties
          }
          onClick={(e) => e.stopPropagation()}
        >
          {theme === 'receipt' ? (
            <ReceiptView
              ticket={ticket}
              posterUrl={posterUrl}
              onPosterOpen={() => setPosterOpen(true)}
              onVenueOpen={() => setMapOpen(true)}
              /* 종이에서는 포스터 옆 빈 자리에 사진첩 아이콘만 둔다 */
              aside={
                album && photoCount ? (
                  <button className="rc__album" onClick={() => setAlbumOpen(true)} aria-label="그날의 사진">
                    <Images aria-hidden="true" />
                    <span>{photoCount}</span>
                  </button>
                ) : null
              }
            />
          ) : (
            <TicketView
              ticket={ticket}
              posterUrl={posterUrl}
              onPosterOpen={() => setPosterOpen(true)}
              onVenueOpen={() => setMapOpen(true)}
            />
          )}

          {/* 밤하늘에서는 아래 버튼 줄이 '다루는' 자리라, 딸린 사진첩은 티켓에 붙은 뱃지로 알린다 */}
          {theme !== 'receipt' && album && photoCount ? (
            <button className="detail__album" onClick={() => setAlbumOpen(true)}>
              <Images aria-hidden="true" />
              그날의 사진
            </button>
          ) : null}
        </div>

      </div>

      {/* 스크롤하지 않아도 늘 보이도록 아래에 붙인 버튼 줄 */}
      <nav className="detail__actions" aria-label="티켓 동작" onClick={(e) => e.stopPropagation()}>
        <button className="action action--primary" disabled={!image} onClick={save}>
          <Download aria-hidden="true" />
          {image ? '이미지 저장' : '만드는 중…'}
        </button>
        {shareable && (
          <button className="action" onClick={() => void share()}>
            <Share2 aria-hidden="true" />
            공유
          </button>
        )}
        <button className="action" onClick={onEdit}>
          <Pencil aria-hidden="true" />
          수정
        </button>
        <button className="action" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" />
          삭제
        </button>
        <button className="action" onClick={onClose}>
          <X aria-hidden="true" />
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
        <AlbumView album={album} onAdd={() => {}} readOnly onClose={() => setAlbumOpen(false)} />
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

