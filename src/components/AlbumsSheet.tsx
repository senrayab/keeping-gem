import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type ChangeEvent } from 'react'
import { addPhoto, db, deleteAlbums, type Album } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { useScrollLock } from '@/hooks/useScrollLock'
import { formatDateRange } from '@/lib/format'
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
    setBusy({ done: 0, total: files.length })
    // 한 장씩 처리한다 — 여러 장을 한꺼번에 펼치면 휴대폰 메모리가 모자랄 수 있다
    for (const [i, file] of files.entries()) {
      try {
        // file.lastModified는 대개 사진을 찍은 때다 — 넣은 순서가 아니라 이 시각으로 늘어놓는다
        await addPhoto(albumId, await processImage(file, PHOTO_MAX_EDGE), file.lastModified || undefined)
      } catch (e) {
        console.error(e)
        failed += 1
      }
      setBusy({ done: i + 1, total: files.length })
    }
    setBusy(null)
    const saved = files.length - failed
    toast(saved > 0 ? `사진 ${saved}장을 넣었어요.` : '사진을 넣지 못했어요.')
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
                {selecting ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 7h14M10 11v6m4-6v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7" />
                  </svg>
                )}
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

        {albums?.map((album) => (
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
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="6.5" width="14" height="11" rx="2.5" />
            <path d="M7 6.5V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9" />
            <path d="M6.5 14.5 9 12l2.5 2 2-1.5 3.5 3" />
          </svg>
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
function AlbumCard({ album, selecting, checked, onOpen, onAdd, onEdit }: AlbumCardProps) {
  const photos = useLiveQuery(() => db.photos.where('albumId').equals(album.id).limit(3).toArray(), [album.id])
  const count = useLiveQuery(() => db.photos.where('albumId').equals(album.id).count(), [album.id])

  return (
    <section className={`album${checked ? ' is-checked' : ''}`}>
      <button
        className="album__stack"
        onClick={onOpen}
        aria-label={selecting ? `${album.title} 고르기` : `${album.title} 사진첩 열기`}
        aria-pressed={selecting ? checked : undefined}
      >
        <span className="album__shots">
          {photos?.length ? (
            photos.map((photo) => <Shot key={photo.id} blob={photo.thumb} />)
          ) : (
            <span className="album__none">아직 사진이 없어요</span>
          )}
        </span>
        {selecting ? (
          <span className={`album__check${checked ? ' is-on' : ''}`} aria-hidden="true">
            {checked && (
              <svg viewBox="0 0 24 24">
                <path d="m5 12.5 5 5 9-11" />
              </svg>
            )}
          </span>
        ) : (
          <span className="album__bar">
            <span
              className="album__add"
              role="button"
              tabIndex={0}
              aria-label="사진 넣기"
              onClick={(e) => {
                e.stopPropagation()
                onAdd()
              }}
            >
              +
            </span>
          </span>
        )}
      </button>

      <div className="album__meta">
        <div>
          <h3>{album.title}</h3>
          <p>
            {formatDateRange(album.date, album.endDate)}
            {count != null && ` · 사진 ${count}장`}
          </p>
        </div>
        {!selecting && (
          <button type="button" className="album__edit" onClick={onEdit} aria-label={`${album.title} 사진첩 수정`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
            </svg>
          </button>
        )}
      </div>
    </section>
  )
}

function Shot({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob)
  return <span className="album__shot">{url && <img src={url} alt="" loading="lazy" />}</span>
}
