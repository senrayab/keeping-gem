import Dexie, { type Table } from 'dexie'
import type { ProcessedImage } from '@/lib/image'
import type { CategoryId } from '@/lib/categories'
import type { CurrencyId } from '@/lib/currencies'

/**
 * 티켓 한 장. 밤하늘을 그릴 때는 이것만 읽는다 —
 * 포스터 본체는 무거우므로 posters 표에 따로 두고 상세보기에서만 꺼낸다.
 */
export interface Ticket {
  id: string
  title: string
  category: CategoryId
  /** 관람일 "YYYY-MM-DD" */
  date: string
  /** "HH:mm" */
  time?: string
  venue?: string
  /** 장소를 지도에서 고른 경우의 좌표·주소 (직접 적은 장소는 없다) */
  lat?: number
  lng?: number
  address?: string
  seat?: string
  price?: number
  /** 금액의 통화. 없으면 원화 (v1 시절 티켓) */
  currency?: CurrencyId
  memo?: string
  /** 별 안에 비치는 작은 포스터 */
  thumb?: Blob
  /** 포스터 대표색 "r g b" */
  glow?: string
  /** 포스터 가로/세로 비율 */
  posterRatio?: number
  createdAt: number
  updatedAt: number
}

export interface Poster {
  ticketId: string
  blob: Blob
}

/**
 * 사진첩 — 그날의 사진을 모아 두는 곳. 티켓 한 장에 하나씩 달 수도 있고,
 * 티켓 없이 따로 만들 수도 있다.
 */
export interface Album {
  id: string
  title: string
  /** 시작일 "YYYY-MM-DD" */
  date: string
  /** 마지막 날 — 이틀 이상 이어진 일정일 때만 있다 (2박 3일 콘서트 등) */
  endDate?: string
  /** 이어 둔 티켓들 — 같은 공연을 여러 날 본 경우 여러 장이 걸린다 */
  ticketIds?: string[]
  createdAt: number
  updatedAt: number
}

/** 사진 한 장의 정보와 썸네일. 원본은 photoImages에 따로 둔다(목록이 무거워지지 않게). */
export interface Photo {
  id: string
  albumId: string
  thumb: Blob
  width: number
  height: number
  bytes: number
  /** 사진이 찍힌 때 (파일에 적힌 시각). 모르면 넣은 때를 쓴다 */
  takenAt?: number
  createdAt: number
}

export interface PhotoImage {
  photoId: string
  blob: Blob
}

export type TicketInput = Pick<
  Ticket,
  | 'title'
  | 'category'
  | 'date'
  | 'time'
  | 'venue'
  | 'lat'
  | 'lng'
  | 'address'
  | 'seat'
  | 'price'
  | 'currency'
  | 'memo'
>

class KeepingGemDB extends Dexie {
  tickets!: Table<Ticket, string>
  posters!: Table<Poster, string>
  albums!: Table<Album, string>
  photos!: Table<Photo, string>
  photoImages!: Table<PhotoImage, string>

  constructor() {
    super('keeping-gem')
    this.version(1).stores({
      photos: 'id, createdAt',
      images: 'photoId',
    })
    // v2: 사진 보관함을 티켓 보관함으로 바꾼다. 시험용이던 사진 표는 지운다.
    this.version(2).stores({
      photos: null,
      images: null,
      tickets: 'id, date, createdAt',
      posters: 'ticketId',
    })
    // v3: 사진첩을 더한다. 사진 본체는 따로 둬서 목록을 읽을 때 딸려 오지 않게 한다.
    this.version(3).stores({
      tickets: 'id, date, createdAt',
      posters: 'ticketId',
      albums: 'id, date, ticketId, createdAt',
      photos: 'id, albumId, [albumId+createdAt]',
      photoImages: 'photoId',
    })
    /*
     * v4: 사진첩 하나에 티켓을 여러 장 걸 수 있게 한다(*ticketIds).
     * 이틀 이상 이어진 공연은 하루씩 나누지 않고 한 사진첩에 모아 두는 편이 낫다.
     */
    this.version(4)
      .stores({
        tickets: 'id, date, createdAt',
        posters: 'ticketId',
        albums: 'id, date, *ticketIds, createdAt',
        photos: 'id, albumId, [albumId+createdAt]',
        photoImages: 'photoId',
      })
      .upgrade(async (tx) => {
        await tx
          .table('albums')
          .toCollection()
          .modify((album: Album & { ticketId?: string }) => {
            album.ticketIds = album.ticketId ? [album.ticketId] : []
            delete album.ticketId
          })
      })
  }
}

export const db = new KeepingGemDB()

/*
 * 저장소 구조를 바꾸는(버전을 올리는) 새 버전은, 옛 버전이 저장소를 붙잡고 있으면
 * 그게 놓아줄 때까지 기다린다. 안드로이드는 뒤에 둔 탭을 얼려 두므로 옛 탭은 끝내
 * 놓아주지 않고, 새 버전의 저장은 '저장 중…'에서 멈춘 채 아무 말이 없다.
 * 그래서 두 쪽 모두 화면에 알린다 (DbNotice.tsx).
 */
export type DbNotice = 'blocked' | 'outdated' | null

/** 마지막 안내. 화면이 뜨기 전에 온 안내도 놓치지 않도록 남겨 둔다. */
export let dbNotice: DbNotice = null

function notify(next: DbNotice) {
  dbNotice = next
  window.dispatchEvent(new CustomEvent<DbNotice>('db-notice', { detail: next }))
}

// 이쪽이 새 버전: 다른 곳에 열린 옛 버전 때문에 열지 못하고 기다리는 중
db.on('blocked', () => notify('blocked'))
/*
 * 기다리는 중에 새로고침하면 브라우저가 blocked를 다시 알려주지 않는다 — 앞서 떠난
 * 페이지의 요청 뒤에 줄만 선다. 그래서 몇 초가 지나도 열리지 않으면 같은 까닭으로 본다.
 */
const OPEN_PATIENCE = 3000
void db.open().catch(() => {})
window.setTimeout(() => {
  if (!db.isOpen() && dbNotice === null) notify('blocked')
}, OPEN_PATIENCE)
db.on('ready', () => {
  if (dbNotice === 'blocked') notify(null)
})
// 이쪽이 옛 버전: 새 버전이 열리려 한다. 바로 놓아주고 새로고침을 권한다.
db.on('versionchange', () => {
  db.close()
  notify('outdated')
  return false
})

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/**
 * 티켓을 새로 만들거나 고친다.
 * poster: 새 포스터면 ProcessedImage, 지우려면 null, 그대로 두려면 undefined.
 */
export async function saveTicket(
  input: TicketInput,
  poster: ProcessedImage | null | undefined,
  id?: string,
): Promise<string> {
  const now = Date.now()
  const ticketId = id ?? uid()

  await db.transaction('rw', db.tickets, db.posters, async () => {
    const prev = id ? await db.tickets.get(id) : undefined
    const next: Ticket = {
      ...prev,
      ...input,
      id: ticketId,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    }
    if (poster) {
      next.thumb = poster.thumb.blob
      next.glow = poster.color
      next.posterRatio = poster.full.width / poster.full.height
      await db.posters.put({ ticketId, blob: poster.full.blob })
    } else if (poster === null) {
      delete next.thumb
      delete next.glow
      delete next.posterRatio
      await db.posters.delete(ticketId)
    }
    await db.tickets.put(next)
  })

  return ticketId
}

export async function saveAlbum(
  input: Pick<Album, 'title' | 'date' | 'endDate' | 'ticketIds'>,
  id?: string,
): Promise<string> {
  const now = Date.now()
  const albumId = id ?? uid()
  const prev = id ? await db.albums.get(id) : undefined
  await db.albums.put({
    ...input,
    id: albumId,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  })
  return albumId
}

/** 사진 한 장을 사진첩에 넣는다 */
export async function addPhoto(albumId: string, image: ProcessedImage, takenAt?: number): Promise<void> {
  const id = uid()
  await db.transaction('rw', db.photos, db.photoImages, db.albums, async () => {
    await db.photos.add({
      id,
      albumId,
      thumb: image.thumb.blob,
      width: image.full.width,
      height: image.full.height,
      bytes: image.full.blob.size + image.thumb.blob.size,
      takenAt,
      createdAt: Date.now(),
    })
    await db.photoImages.add({ photoId: id, blob: image.full.blob })
    await db.albums.update(albumId, { updatedAt: Date.now() })
  })
}

export async function deletePhoto(id: string): Promise<void> {
  await deletePhotos([id])
}

/** 고른 사진을 한꺼번에 지운다 */
export async function deletePhotos(ids: string[]): Promise<void> {
  if (!ids.length) return
  await db.transaction('rw', db.photos, db.photoImages, async () => {
    await db.photos.bulkDelete(ids)
    await db.photoImages.bulkDelete(ids)
  })
}

/** 고른 사진첩과 그 안의 사진을 한꺼번에 지운다 */
export async function deleteAlbums(ids: string[]): Promise<void> {
  for (const id of ids) await deleteAlbum(id)
}

/** 사진첩과 그 안의 사진을 모두 지운다 */
export async function deleteAlbum(albumId: string): Promise<void> {
  await db.transaction('rw', db.albums, db.photos, db.photoImages, async () => {
    const ids = await db.photos.where('albumId').equals(albumId).primaryKeys()
    await db.photos.bulkDelete(ids)
    await db.photoImages.bulkDelete(ids)
    await db.albums.delete(albumId)
  })
}

export async function deleteTicket(id: string): Promise<void> {
  await db.transaction('rw', db.tickets, db.posters, async () => {
    await db.tickets.delete(id)
    await db.posters.delete(id)
  })
}
