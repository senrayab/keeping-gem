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
 * 책상 위에 펼쳐 놓은 사진들.
 *
 * 줄을 맞춰 늘어놓지 않는다 — 조금씩 비뚤고 겹치게 둬야 '그날 찍은 사진을
 * 꺼내 놓은' 느낌이 난다. 다만 아무렇게나 흩뿌리면 못 찾으므로,
 * 두 장씩 지그재그로 내려가는 큰 흐름은 지킨다. 자리는 사진마다 정해져 있어
 * 열 때마다 바뀌지 않는다.
 */
const ROW_H = 168
const TOP = 12

interface Spot {
  left: number
  top: number
  rotate: number
  width: number
  z: number
}

function spot(photo: Photo, index: number): Spot {
  const rand = seeded(photo.id)
  const width = 46 + rand() * 8
  const column = index % 2
  // 왼쪽 칸은 왼쪽 가에, 오른쪽 칸은 오른쪽 가에 — 어느 쪽도 화면 밖으로 나가지 않게 가둔다
  const left = column === 0 ? 2 + rand() * 6 : Math.min(46 + rand() * 6, 97 - width)
  return {
    left,
    top: TOP + index * (ROW_H / 2) + (rand() - 0.5) * 22,
    rotate: (rand() - 0.5) * 14,
    width,
    z: Math.floor(rand() * 10),
  }
}

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

  const height = photos?.length ? TOP + (photos.length - 1) * (ROW_H / 2) + ROW_H + 40 : 0

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

      <div className="album-view__desk" style={{ height }}>
        {photos?.length === 0 && (
          <p className="album-view__empty">
            {readOnly ? '아직 사진이 없어요. 보관함 → 사진첩에서 넣을 수 있어요.' : '아래 버튼으로 그날의 사진을 넣어 보세요.'}
          </p>
        )}
        {photos?.map((photo, i) => (
          <Print key={photo.id} photo={photo} spot={spot(photo, i)} onOpen={() => setOpened(photo)} />
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
function Print({ photo, spot, onOpen }: { photo: Photo; spot: Spot; onOpen: () => void }) {
  const url = useObjectUrl(photo.thumb)
  const style = {
    left: `${spot.left}%`,
    top: spot.top,
    width: `${spot.width}%`,
    zIndex: spot.z,
    '--rotate': `${spot.rotate}deg`,
  } as CSSProperties

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
