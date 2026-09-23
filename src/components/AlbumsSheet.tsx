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
            {albums.map((album, index) => (
              <AlbumCard
                key={album.id}
                album={album}
                index={index}
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
  /** 탭을 어긋나게 놓는 데 쓴다 */
  index: number
  selecting: boolean
  checked: boolean
  onOpen: () => void
  onAdd: () => void
  onEdit: () => void
}

/** 사진첩 한 칸: 겹쳐 놓인 사진 + 가로지르는 반투명 바 + 제목·날짜·수정 */
/*
 * 사진첩 한 칸은 보관 상자에 꽂힌 색인 카드다.
 *
 * 카드 뒤로 그 안의 사진이 비스듬히 꽂혀 윗머리만 보이고, 카드 위로는 이름표(탭)가 솟아 있다.
 * 탭의 좌우 자리와 빛깔은 사진첩마다 달라(--tab, --tint) 서랍을 열어 본 듯하게 한다.
 */
const TAB_SPOTS = ['16px', '32%', '54%']
/* 색인 카드 라벨 빛깔 — 문구점에서 파는 인덱스 카드처럼 */
const TAB_TINTS = ['#f6d06a', '#8fc3ec', '#98ddb0', '#f0a5bf', '#bfaaf0', '#f2b184']

function AlbumCard({ album, index, selecting, checked, onOpen, onAdd, onEdit }: AlbumCardProps) {
  const photos = useLiveQuery(() => db.photos.where('albumId').equals(album.id).limit(3).toArray(), [album.id])
  const count = useLiveQuery(() => db.photos.where('albumId').equals(album.id).count(), [album.id])
  const tint = TAB_TINTS[Math.floor(seeded(album.id)() * TAB_TINTS.length)]

  return (
    <section
      className={`file${checked ? ' is-checked' : ''}`}
      style={{ '--tab': TAB_SPOTS[index % TAB_SPOTS.length], '--tint': tint } as CSSProperties}
    >
      {/* 카드 뒤에 꽂힌 사진들 — 윗머리만 삐져나온다 */}
      <span className="file__peeks" aria-hidden="true">
        {photos?.map((photo, i) => (
          <Peek key={photo.id} blob={photo.thumb} slot={i} />
        ))}
      </span>

      <button
        className="file__card"
        onClick={onOpen}
        aria-label={selecting ? `${album.title} 고르기` : `${album.title} 사진첩 열기`}
        aria-pressed={selecting ? checked : undefined}
      >
        <span className="file__tab">{album.title}</span>

        <span className="file__front">
          <span className="file__date">{formatDateRange(album.date, album.endDate)}</span>
          <span className="file__count">{count != null ? (count > 0 ? `${count}장` : '비어 있음') : ''}</span>
        </span>

        {selecting && (
          <span className={`file__check${checked ? ' is-on' : ''}`} aria-hidden="true">
            {checked && <Check aria-hidden="true" />}
          </span>
        )}
      </button>

      {!selecting && (
        <div className="file__tools">
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

/** 카드 뒤에 꽂힌 사진 한 장 */
function Peek({ blob, slot }: { blob: Blob; slot: number }) {
  const url = useObjectUrl(blob)
  return <span className={`file__peek file__peek--${slot}`}>{url && <img src={url} alt="" loading="lazy" />}</span>
}
