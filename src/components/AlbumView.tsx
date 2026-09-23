import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ImagePlus, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type CSSProperties } from 'react'
import { db, deletePhoto, deletePhotos, type Album, type Photo } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useSweepSelect } from '@/hooks/useSweepSelect'
import { formatDateRange } from '@/lib/format'
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
// 지금은 '정돈'만 쓴다. 쏟아 놓기(자유)는 아래에 주석으로 남겨 두었다. (TOP·Spot도 그때 쓴다)
// const TOP = 10

/** 벽돌 쌓기 칸 수 */
const COLUMNS = 3

/** 사진을 늘어놓는 순서 — 최신순(늦게 찍은 것부터) / 날짜순(먼저 찍은 것부터) */
type PhotoOrder = 'newest' | 'oldest'
const ORDER_KEY = 'keeping-gem:photo-order'

const takenAt = (photo: Photo) => photo.takenAt ?? photo.createdAt

/**
 * 사진을 세 칸에 나눠 담는다.
 *
 * 앞에서부터 차례로, 그때그때 가장 낮은 칸에 놓는다 — 그래야 최신 사진이 위쪽에 모이고
 * 왼쪽에서 오른쪽으로 읽힌다. (칸 하나를 끝까지 채우고 다음 칸으로 넘어가면
 * 날짜 순서가 위아래로 흩어져 뒤죽박죽으로 보인다)
 */
function toColumns(photos: Photo[]): Photo[][] {
  const columns: Photo[][] = Array.from({ length: COLUMNS }, () => [])
  const heights = new Array<number>(COLUMNS).fill(0)
  for (const photo of photos) {
    const shortest = heights.indexOf(Math.min(...heights))
    columns[shortest].push(photo)
    // 칸 너비가 같으므로 세로 비율만으로 높이를 가늠할 수 있다
    heights[shortest] += photo.height / photo.width
  }
  return columns
}

interface Spot {
  left: number
  top: number
  rotate: number
  width: number
  z: number
}

// /**
//  * 쏟아 놓기.
//  *
//  * 겹치되 가려지지는 않아야 한다 — 이웃한 사진을 좌우로 번갈아 놓고 세로 간격을 넉넉히 둬,
//  * 어느 장이든 절반 넘게 드러나게 한다. 가장자리는 살짝 넘겨 더미 한가운데를 보는 느낌만 남긴다.
//  */
// /*
//  * 잡지 콜라주처럼 붙인다.
//  *
//  * 크기를 섞고(작은 것과 큰 것) 가운데로 모아 겹치되, 좌우로 조금씩 흘려 여백을 채운다.
//  * 기울기는 대체로 얕게 두고 가끔 한 장씩 크게 틀어 손으로 붙인 티를 낸다.
//  */
// function pileSpot(photo: Photo, index: number): Spot {
//   const rand = seeded(photo.id)
//   // 넷 중 하나는 크게 — 큰 사진이 중심을 잡아 준다
//   const big = index % 4 === 1
//   const width = big ? 48 + rand() * 12 : 28 + rand() * 12
//   const drift = (index % 2 === 0 ? -1 : 1) * (6 + rand() * 16)
//   const left = Math.min(Math.max(50 - width / 2 + drift, -6), 102 - width)
//   const tilt = index % 5 === 2 ? 14 + rand() * 10 : rand() * 9
//   return {
//     left,
//     top: TOP + index * PILE_STEP + (rand() - 0.5) * 24,
//     rotate: (index % 2 === 0 ? -tilt : tilt),
//     width,
//     z: Math.floor(rand() * 20),
//   }
// }

/** 콜라주에서 사진마다 다른 기울기 — 벽에 손으로 붙인 듯하게 */
const collageTilt = (photo: Photo) => (seeded(`${photo.id}:tilt`)() - 0.5) * 7

interface AlbumViewProps {
  album: Album
  onAdd: () => void
  /** 티켓 상세보기에서 열었을 때 — 사진을 넣거나 지우지 않고 보기만 한다 */
  readOnly?: boolean
  onClose: () => void
}

export function AlbumView({ album, onAdd, readOnly, onClose }: AlbumViewProps) {
  useBackClose(onClose)
  useScrollLock()
  const toast = useToast()
  const [order, setOrder] = useState<PhotoOrder>(() => {
    try {
      return localStorage.getItem(ORDER_KEY) === 'oldest' ? 'oldest' : 'newest'
    } catch {
      return 'newest'
    }
  })
  const toggleOrder = () => {
    const next: PhotoOrder = order === 'newest' ? 'oldest' : 'newest'
    setOrder(next)
    try {
      localStorage.setItem(ORDER_KEY, next)
    } catch {
      // 기억하지 못해도 보는 데는 지장이 없다
    }
  }

  /*
   * 찍힌 때를 기준으로 늘어놓는다.
   * 넣은 순서로 두면, 예전 사진을 나중에 보태는 순간 이야기의 흐름이 뒤엉킨다.
   * (찍힌 때를 모르는 사진은 넣은 때를 대신 쓴다)
   */
  const photos = useLiveQuery(async () => db.photos.where('albumId').equals(album.id).toArray(), [album.id])
  const sorted = useMemo(
    () =>
      [...(photos ?? [])].sort((a, b) => (order === 'newest' ? takenAt(b) - takenAt(a) : takenAt(a) - takenAt(b))),
    [photos, order],
  )
  const [opened, setOpened] = useState<Photo | null>(null)
  const columns = useMemo(() => toColumns(sorted), [sorted])
  /* 꾹 눌러 고르고 끌어서 여러 장 — 손가락 아래 사진을 자리로 찾는다 */
  const sweep = useSweepSelect({
    idAt: (x, y) => {
      const el = document.elementFromPoint(x, y)
      return el instanceof Element ? (el.closest('.print') as HTMLElement | null)?.dataset.photo : undefined
    },
  })
  const [confirming, setConfirming] = useState(false)

  const removePicked = async () => {
    const ids = [...sweep.selected]
    setConfirming(false)
    await deletePhotos(ids)
    sweep.stop()
    toast(`사진 ${ids.length}장을 지웠어요.`)
  }

  return (
    <div
      className="album-view"
      role="dialog"
      aria-modal="true"
      aria-label={`${album.title} 사진첩`}
      // 티켓 상세보기 안에서 열릴 수 있다 — 막지 않으면 사진을 누를 때 상세보기까지 닫힌다
      onClick={(e) => e.stopPropagation()}
    >
      <header className="album-view__head">
        <div>
          <h2>{album.title}</h2>
          <p>
            {sweep.selecting
              ? `${sweep.selected.size}장 고름 · 꾹 눌러 끌면 여러 장`
              : `${formatDateRange(album.date, album.endDate)}${photos ? ` · 사진 ${photos.length}장` : ''}`}
          </p>
        </div>
        {!sweep.selecting && photos && photos.length > 1 && (
          <button type="button" className="btn btn--ghost btn--small order-btn" onClick={toggleOrder}>
            {order === 'newest' ? <ArrowDownWideNarrow aria-hidden="true" /> : <ArrowUpNarrowWide aria-hidden="true" />}
            {order === 'newest' ? '최신순' : '날짜순'}
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--small btn--icon"
          onClick={() => (sweep.selecting ? sweep.stop() : onClose())}
          aria-label={sweep.selecting ? '고르기 그만두기' : '닫기'}
        >
          <X aria-hidden="true" />
        </button>
      </header>

      {/*
       * 배치 고르기(정돈 / 자유)는 지금 쓰지 않는다 — 정돈만 남겨 사진이 위까지 올라오게 했다.
       * 되살리려면 이 주석과 위의 pileSpot 주석을 함께 푼다.
      // {photos && photos.length > 0 && (
      // <div className="desk-switch" role="group" aria-label="사진 놓는 방식">
      // <button
      // type="button"
      // className={layout === 'collage' ? 'is-active' : undefined}
      // onClick={() => changeLayout('collage')}
      // >
      // 정돈
      // </button>
      // <button
      // type="button"
      // className={layout === 'pile' ? 'is-active' : undefined}
      // onClick={() => changeLayout('pile')}
      // >
      // 자유
      // </button>
      // </div>
      // )}
      */}

      <div
        className={`album-view__desk album-view__desk--collage${sweep.selecting ? ' is-selecting' : ''}`}
        onPointerMove={(e) => sweep.onPointerMove(e)}
        onPointerUp={sweep.onPointerUp}
        onPointerCancel={sweep.onPointerUp}
      >
        {photos?.length === 0 && (
          <p className="album-view__empty">
            {readOnly ? '아직 사진이 없어요. 머리말의 사진첩에서 넣을 수 있어요.' : '아래 버튼으로 그날의 사진을 넣어 보세요.'}
          </p>
        )}
        {columns.map((column, i) => (
          <div className="desk__column" key={i}>
            {column.map((photo) => (
              <Print
                key={photo.id}
                photo={photo}
                tilt={collageTilt(photo)}
                picked={sweep.selected.has(photo.id)}
                selecting={sweep.selecting}
                onPointerDown={readOnly ? undefined : (e) => sweep.onPointerDown(photo.id, e)}
                onOpen={() => setOpened(photo)}
              />
            ))}
          </div>
        ))}
      </div>

      {!readOnly &&
        (sweep.selecting ? (
          <div className="select-bar select-bar--desk">
            <button className="btn btn--ghost" onClick={sweep.stop}>
              그만두기
            </button>
            <button
              className="btn btn--danger"
              disabled={sweep.selected.size === 0}
              onClick={() => setConfirming(true)}
            >
              {sweep.selected.size > 0 ? `${sweep.selected.size}장 지우기` : '지우기'}
            </button>
          </div>
        ) : (
          /* 아래 바로 깔면 사진을 가린다 — 떠 있는 단추로 두고, 사진은 그만큼 자리를 비운다 */
          <button className="album-fab" onClick={onAdd} aria-label="사진 넣기">
            <ImagePlus aria-hidden="true" />
          </button>
        ))}

      {confirming && (
        <ConfirmDialog
          title={`사진 ${sweep.selected.size}장을 지울까요?`}
          message="되돌릴 수 없어요."
          danger
          confirmLabel="지우기"
          onConfirm={() => void removePicked()}
          onCancel={() => setConfirming(false)}
        />
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
  picked,
  selecting,
  onPointerDown,
  onOpen,
}: {
  photo: Photo
  /** 쏟아 놓기에서만 쓴다. 정돈일 때는 3열 흐름에 맡긴다. */
  spot?: Spot
  tilt: number
  picked: boolean
  selecting: boolean
  onPointerDown?: (event: { clientX: number; clientY: number }) => void
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
    <button
      className={`print${picked ? ' is-picked' : ''}`}
      style={style}
      data-photo={photo.id}
      onPointerDown={onPointerDown}
      // 길게 누르면 안드로이드가 '이미지 공유/복사' 메뉴를 띄운다 — 고르는 중이므로 막는다
      onContextMenu={(e) => e.preventDefault()}
      // 고르는 중에는 누름을 pointerdown에서 이미 다뤘다. 여기서 또 다루면 골랐다 풀렸다 한다.
      onClick={selecting ? undefined : onOpen}
      aria-label="사진 크게 보기"
      aria-pressed={picked}
    >
      {/* 브라우저 기본 '그림 끌어다 놓기'를 막는다 — 그게 끼어들면 끌어서 고르기가 끊긴다 */}
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          draggable={false}
          /* 비율을 미리 알려 두면 그림이 도착하기 전에도 자리가 잡혀 화면이 덜컥이지 않는다 */
          style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        />
      )}
      {picked && (
        <span className="print__check" aria-hidden="true">
          <Check aria-hidden="true" />
        </span>
      )}
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
        <button className="btn btn--light btn--icon" onClick={onClose} aria-label="닫기">
          <X aria-hidden="true" />
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
