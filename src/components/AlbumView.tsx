import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type CSSProperties } from 'react'
import { db, deletePhoto, type Album, type Photo } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { useScrollLock } from '@/hooks/useScrollLock'
import { formatDate } from '@/lib/format'
import { seeded } from '@/lib/seed'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'

/*
 * 펼쳐 놓은 사진들. 두 가지로 볼 수 있다.
 *
 * - 정돈: 벽에 붙인 콜라주처럼 작은 사진이 3열로 촘촘히, 살짝씩만 비뚤게.
 *         장수가 많아도 한눈에 훑을 수 있다.
 * - 자유: 폴라로이드를 쏟아 놓은 것처럼 크게 겹치고 많이 기울어지게.
 *         가장자리를 조금 넘겨 화면이 사진으로 가득 차 보이게 한다.
 *
 * 어느 쪽이든 기울기와 자리는 사진마다 정해져 있어 열 때마다 바뀌지 않는다.
 */
export type DeskLayout = 'collage' | 'pile'

const LAYOUT_KEY = 'keeping-gem:desk'
const PILE_STEP = 66
const TOP = 10

interface Spot {
  left: number
  top: number
  rotate: number
  width: number
  z: number
}

/** 쏟아 놓기 */
function pileSpot(photo: Photo, index: number): Spot {
  const rand = seeded(photo.id)
  const width = 42 + rand() * 16
  return {
    // 가장자리를 살짝 넘겨 잘리게 둔다 — 사진 더미 한가운데를 보는 느낌
    left: -7 + rand() * (107 - width),
    top: TOP + index * PILE_STEP + (rand() - 0.5) * 28,
    rotate: (rand() - 0.5) * 34,
    width,
    z: Math.floor(rand() * 20),
  }
}

/** 콜라주에서 사진마다 다른 기울기 — 벽에 손으로 붙인 듯하게 */
const collageTilt = (photo: Photo) => (seeded(`${photo.id}:tilt`)() - 0.5) * 7

interface AlbumViewProps {
  album: Album
  onAdd: () => void
  onEdit: () => void
  /** 티켓 상세보기에서 열었을 때 — 사진첩을 고치지 않고 보기만 한다 */
  readOnly?: boolean
  onClose: () => void
}

export function AlbumView({ album, onAdd, onEdit, readOnly, onClose }: AlbumViewProps) {
  useBackClose(onClose)
  useScrollLock()
  const toast = useToast()
  const photos = useLiveQuery(
    () => db.photos.where('[albumId+createdAt]').between([album.id, 0], [album.id, Infinity]).toArray(),
    [album.id],
  )
  const [opened, setOpened] = useState<Photo | null>(null)
  const [layout, setLayout] = useState<DeskLayout>(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === 'pile' ? 'pile' : 'collage'
    } catch {
      return 'collage'
    }
  })
  const changeLayout = (next: DeskLayout) => {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      // 기억하지 못해도 보는 데는 지장이 없다
    }
  }

  // 쏟아 놓기는 자리를 직접 잡으므로 높이도 직접 알려줘야 한다
  const pileHeight = photos?.length ? TOP + (photos.length - 1) * PILE_STEP + 230 : 0

  return (
    <div className="album-view" role="dialog" aria-modal="true" aria-label={`${album.title} 사진첩`}>
      <header className="album-view__head">
        <div>
          <h2>{album.title}</h2>
          <p>
            {formatDate(album.date)}
            {photos && ` · 사진 ${photos.length}장`}
          </p>
        </div>
        {!readOnly && (
          <button type="button" className="btn btn--ghost btn--small" onClick={onEdit}>
            수정
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          닫기
        </button>
      </header>

      {photos && photos.length > 0 && (
        <div className="desk-switch" role="group" aria-label="사진 놓는 방식">
          <button
            type="button"
            className={layout === 'collage' ? 'is-active' : undefined}
            onClick={() => changeLayout('collage')}
          >
            정돈
          </button>
          <button
            type="button"
            className={layout === 'pile' ? 'is-active' : undefined}
            onClick={() => changeLayout('pile')}
          >
            자유
          </button>
        </div>
      )}

      <div
        className={`album-view__desk album-view__desk--${layout}`}
        style={layout === 'pile' ? { height: pileHeight } : undefined}
      >
        {photos?.length === 0 && (
          <p className="album-view__empty">
            {readOnly ? '아직 사진이 없어요. 보관함 → 사진첩에서 넣을 수 있어요.' : '아래 버튼으로 그날의 사진을 넣어 보세요.'}
          </p>
        )}
        {photos?.map((photo, i) => (
          <Print
            key={photo.id}
            photo={photo}
            spot={layout === 'pile' ? pileSpot(photo, i) : undefined}
            tilt={collageTilt(photo)}
            onOpen={() => setOpened(photo)}
          />
        ))}
      </div>

      {!readOnly && (
        <div className="album-view__foot">
          <button className="btn btn--glow" onClick={onAdd}>
            사진 넣기
          </button>
        </div>
      )}

      {opened && <PhotoDetail photo={opened} onClose={() => setOpened(null)} onDeleted={() => toast('사진을 지웠어요.')} />}
    </div>
  )
}

/** 인화지 한 장처럼 흰 테두리를 두르고 조금 비뚤게 놓인 사진 */
function Print({
  photo,
  spot,
  tilt,
  onOpen,
}: {
  photo: Photo
  /** 쏟아 놓기에서만 쓴다. 정돈일 때는 3열 흐름에 맡긴다. */
  spot?: Spot
  tilt: number
  onOpen: () => void
}) {
  const url = useObjectUrl(photo.thumb)
  const style = spot
    ? ({
        left: `${spot.left}%`,
        top: spot.top,
        width: `${spot.width}%`,
        zIndex: spot.z,
        '--rotate': `${spot.rotate}deg`,
      } as CSSProperties)
    : ({ '--rotate': `${tilt}deg` } as CSSProperties)

  return (
    <button className="print" style={style} onClick={onOpen} aria-label="사진 크게 보기">
      {url && <img src={url} alt="" loading="lazy" />}
    </button>
  )
}

/** 사진 한 장 크게 보기 + 지우기 */
function PhotoDetail({ photo, onClose, onDeleted }: { photo: Photo; onClose: () => void; onDeleted: () => void }) {
  useBackClose(onClose)
  const image = useLiveQuery(async () => (await db.photoImages.get(photo.id)) ?? null, [photo.id])
  const url = useObjectUrl(image?.blob ?? photo.thumb)
  const [confirming, setConfirming] = useState(false)

  const remove = async () => {
    setConfirming(false)
    await deletePhoto(photo.id)
    onClose()
    onDeleted()
  }

  return (
    <div className="photo-detail" role="dialog" aria-modal="true" aria-label="사진" onClick={onClose}>
      {url && <img src={url} alt="" />}
      <div className="photo-detail__foot" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn--ghost" onClick={() => setConfirming(true)}>
          지우기
        </button>
        <button className="btn btn--light" onClick={onClose}>
          닫기
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="이 사진을 지울까요?"
          message="되돌릴 수 없어요."
          danger
          confirmLabel="지우기"
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
