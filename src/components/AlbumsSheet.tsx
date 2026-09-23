import { Check, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { addPhoto, albumFingerprints, db, deleteAlbums, type Album } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { useScrollLock } from '@/hooks/useScrollLock'
import { formatDateRange } from '@/lib/format'
import { seeded } from '@/lib/seed'
import { fingerprint } from '@/lib/hash'
import { PHOTO_MAX_EDGE, processImage } from '@/lib/image'
import { AlbumForm } from './AlbumForm'
import { AlbumView } from './AlbumView'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'

/*
 * 사진첩 목록.
 *
 * 사진첩 하나가 카드 한 장이다. 카드 위쪽에는 그 안의 사진이 겹쳐 놓이고,
 * 그 위를 반투명한 바가 가로질러 지나간다 — 바에 있는 +를 누르면 사진을 더 넣는다.
 * 카드를 누르면 사진이 책상 위처럼 펼쳐진다(AlbumView).
 *
 * 휴지통을 누르면 고르기로 바뀌어 여러 개를 한꺼번에 지울 수 있다.
 */
export function AlbumsSheet({ onClose }: { onClose: () => void }) {
  useBackClose(onClose)
  useScrollLock()
  const toast = useToast()
  const albums = useLiveQuery(() => db.albums.orderBy('date').reverse().toArray(), [])
  const [editing, setEditing] = useState<{ album?: Album } | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [confirming, setConfirming] = useState(false)
  const addingTo = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const openedAlbum = opened ? albums?.find((a) => a.id === opened) : undefined
  const selecting = picked !== null

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const pickPhotos = (albumId: string) => {
    addingTo.current = albumId
    fileRef.current?.click()
  }

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const files = [...(input.files ?? [])]
    const albumId = addingTo.current
    input.value = ''
    if (!files.length || !albumId) return

    let failed = 0
    let skipped = 0
    setBusy({ done: 0, total: files.length })
    // 이미 들어 있는 사진들의 지문 — 같은 사진을 두 번 넣지 않는다
    const known = await albumFingerprints(albumId)
    // 한 장씩 처리한다 — 여러 장을 한꺼번에 펼치면 휴대폰 메모리가 모자랄 수 있다
    for (const [i, file] of files.entries()) {
      try {
        const image = await processImage(file, PHOTO_MAX_EDGE)
        const hash = await fingerprint(image.full.blob)
        if (hash && known.has(hash)) {
          skipped += 1
        } else {
          if (hash) known.add(hash)
          // file.lastModified는 대개 사진을 찍은 때다 — 넣은 순서가 아니라 이 시각으로 늘어놓는다
          await addPhoto(albumId, image, file.lastModified || undefined, hash)
        }
      } catch (e) {
        console.error(e)
        failed += 1
      }
      setBusy({ done: i + 1, total: files.length })
    }
    setBusy(null)

    const saved = files.length - failed - skipped
    const already = skipped > 0 ? ` · ${skipped}장은 이미 있어요` : ''
    toast(saved > 0 ? `사진 ${saved}장을 넣었어요${already}` : skipped > 0 ? '이미 있는 사진이에요.' : '사진을 넣지 못했어요.')
  }

  const removePicked = async () => {
    const ids = [...(picked ?? [])]
    setConfirming(false)
    await deleteAlbums(ids)
    setPicked(null)
    toast(`사진첩 ${ids.length}개를 지웠어요.`)
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="사진첩">
      <div className="sheet__body sheet__body--albums">
        <header className="sheet__head">
          <span />
          <h2>{selecting ? `${picked.size}개 고름` : '사진첩'}</h2>
          <div className="sheet__tools">
            {albums?.length ? (
              <button
                type="button"
                className="btn btn--ghost btn--small btn--icon"
                onClick={() => setPicked(selecting ? null : new Set())}
                aria-label={selecting ? '고르기 그만두기' : '사진첩 골라 지우기'}
              >
                {selecting ? <X aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              </button>
            ) : null}
            {!selecting && (
              <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
                닫기
              </button>
            )}
          </div>
        </header>

        {albums?.length === 0 && (
          <p className="albums__empty">
            그날의 사진을 모아 두는 곳이에요.
            <br />
            티켓과 이어 두면 상세보기에서 바로 열 수 있어요.
          </p>
        )}

        {albums && albums.length > 0 && (
          <div className="album-box">
            {albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                selecting={selecting}
                checked={picked?.has(album.id) ?? false}
                onOpen={() => (selecting ? toggle(album.id) : setOpened(album.id))}
                onAdd={() => pickPhotos(album.id)}
                onEdit={() => setEditing({ album })}
              />
            ))}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
      </div>

      {busy && (
        <p className="album-progress" role="status">
          사진 넣는 중 {busy.done}/{busy.total}
        </p>
      )}

      {selecting ? (
        <div className="select-bar">
          <button className="btn btn--ghost" onClick={() => setPicked(null)}>
            그만두기
          </button>
          <button className="btn btn--danger" disabled={picked.size === 0} onClick={() => setConfirming(true)}>
            {picked.size > 0 ? `${picked.size}개 지우기` : '지우기'}
          </button>
        </div>
      ) : (
        /* 사진첩이 아무리 늘어도 자리가 변하지 않도록 떠 있게 둔다 */
        <button
          className="album-fab"
          onClick={() => setEditing({})}
          disabled={busy !== null}
          aria-label="새 사진첩 만들기"
        >
          <ImagePlus aria-hidden="true" />
        </button>
      )}

      {confirming && picked && (
        <ConfirmDialog
          title={`사진첩 ${picked.size}개를 지울까요?`}
          message="안에 있는 사진도 함께 지워져요. 되돌릴 수 없어요."
          danger
          confirmLabel="지우기"
          onConfirm={() => void removePicked()}
          onCancel={() => setConfirming(false)}
        />
      )}

      {editing && (
        <AlbumForm
          album={editing.album}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            const isNew = !editing.album
            setEditing(null)
            // 새로 만든 사진첩은 바로 사진 고르기로 이어 준다
            if (isNew) pickPhotos(id)
          }}
        />
      )}

      {openedAlbum && (
        <AlbumView album={openedAlbum} onAdd={() => pickPhotos(openedAlbum.id)} onClose={() => setOpened(null)} />
      )}
    </div>
  )
}

interface AlbumCardProps {
  album: Album
  selecting: boolean
  checked: boolean
  onOpen: () => void
  onAdd: () => void
  onEdit: () => void
}

/** 사진첩 한 칸: 겹쳐 놓인 사진 + 가로지르는 반투명 바 + 제목·날짜·수정 */
/*
 * 사진첩 한 칸은 카세트 테이프 한 개다.
 *
 * 그날의 포스터(없으면 첫 사진)가 라벨 그림이 되고, 빈티지한 색감과 비닐 반사를 얹는다.
 * 아래쪽에는 릴 두 개와 테이프 창이 있어 한눈에 '녹음해 둔 것'으로 읽힌다.
 * 라벨 빛깔은 사진첩마다 달라(--tint) 선반에 늘어놓은 테이프처럼 보인다.
 */
const TAPE_TINTS = ['#e8b9c8', '#9fd2d8', '#e9cf9a', '#b9b5e8', '#9fd2ae', '#e8b49a']

function AlbumCard({ album, selecting, checked, onOpen, onAdd, onEdit }: AlbumCardProps) {
  const count = useLiveQuery(() => db.photos.where('albumId').equals(album.id).count(), [album.id])
  /* 라벨 그림: 이어 둔 티켓의 포스터를 먼저 쓰고, 없으면 사진첩의 첫 사진 */
  const cover = useLiveQuery(async () => {
    for (const ticketId of album.ticketIds ?? []) {
      const ticket = await db.tickets.get(ticketId)
      if (ticket?.thumb) return ticket.thumb
    }
    const photo = await db.photos.where('albumId').equals(album.id).first()
    return photo?.thumb
  }, [album.id, album.ticketIds?.join(',')])
  const coverUrl = useObjectUrl(cover ?? undefined)
  const tint = TAPE_TINTS[Math.floor(seeded(album.id)() * TAPE_TINTS.length)]

  return (
    <section className={`tape${checked ? ' is-checked' : ''}`} style={{ '--tint': tint } as CSSProperties}>
      <button
        className="tape__body"
        onClick={onOpen}
        aria-label={selecting ? `${album.title} 고르기` : `${album.title} 사진첩 열기`}
        aria-pressed={selecting ? checked : undefined}
      >
        {/* 라벨 — 그날의 그림 위에 제목과 날짜 */}
        <span className="tape__label">
          {coverUrl && <img className="tape__art" src={coverUrl} alt="" loading="lazy" />}
          <span className="tape__grain" aria-hidden="true" />
          <span className="tape__side">A</span>
          <span className="tape__title">{album.title}</span>
          <span className="tape__meta">
            {formatDateRange(album.date, album.endDate)}
            {count != null && count > 0 ? ` · ${count}장` : ''}
          </span>
        </span>

        {/* 테이프 창과 릴 */}
        <span className="tape__deck" aria-hidden="true">
          <span className="tape__reel" />
          <span className="tape__window" />
          <span className="tape__reel" />
        </span>

        {/* 비닐 포장에 비치는 빛 */}
        <span className="tape__sheen" aria-hidden="true" />

        {selecting && (
          <span className={`tape__check${checked ? ' is-on' : ''}`} aria-hidden="true">
            {checked && <Check aria-hidden="true" />}
          </span>
        )}
      </button>

      {!selecting && (
        <div className="tape__tools">
          <button type="button" onClick={onEdit} aria-label={`${album.title} 사진첩 수정`}>
            <Pencil aria-hidden="true" />
          </button>
          <button type="button" onClick={onAdd} aria-label={`${album.title}에 사진 넣기`}>
            <Plus aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
}
