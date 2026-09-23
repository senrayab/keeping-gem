import { unzipSync, zipSync, type Zippable } from 'fflate'
import { db, type Album, type Photo, type PhotoImage, type Poster, type Ticket } from '@/db/db'
import { CATEGORIES } from './categories'
import { today } from './format'

/*
 * 백업 파일: 티켓 정보(backup.json)와 포스터 그림들을 zip 하나에 담는다.
 *
 *   backup.json          앱 이름·형식 버전·만든 때·티켓/사진첩 목록(그림 제외)
 *   thumbs/<id>.<ext>    밤하늘 별에 비치는 작은 포스터
 *   posters/<id>.<ext>   상세보기의 포스터 원본
 *   photos/<id>.<ext>    사진첩 사진 원본
 *   photo-thumbs/<id>.<ext>  사진첩에서 펼쳐 보는 작은 사진
 *
 * 그림을 JSON 안에 글자(base64)로 넣지 않고 파일로 따로 담는다 — 크기가 3분의 1 작고,
 * 압축을 풀면 사람이 포스터를 바로 열어 볼 수도 있다.
 * 그림은 이미 압축된(WebP) 것이라 다시 압축하지 않고 그대로 담는다.
 */

const APP = 'keeping-gem'
const FORMAT = 2
const LAST_BACKUP_KEY = 'keeping-gem:last-backup'

type StoredTicket = Omit<Ticket, 'thumb'> & { thumb?: string }
/** 사진 한 장 — 그림은 zip 안의 파일 이름으로 가리킨다 */
type StoredPhoto = Omit<Photo, 'thumb'> & { thumb?: string; full?: string }

interface BackupFile {
  app: typeof APP
  format: number
  createdAt: number
  tickets: StoredTicket[]
  /** format 2부터 */
  albums?: Album[]
  photos?: StoredPhoto[]
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }
const MIME: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' }

const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())
const fileFor = (dir: string, id: string, blob: Blob) => `${dir}/${id}.${EXT[blob.type] ?? 'bin'}`

export async function createBackup(): Promise<{ blob: Blob; name: string; count: number; photoCount: number }> {
  const [tickets, posters] = await Promise.all([db.tickets.toArray(), db.posters.toArray()])
  const files: Zippable = {}

  const stored: StoredTicket[] = []
  for (const { thumb, ...rest } of tickets) {
    const entry: StoredTicket = { ...rest }
    if (thumb) {
      entry.thumb = fileFor('thumbs', rest.id, thumb)
      files[entry.thumb] = [await bytes(thumb), { level: 0 }]
    }
    stored.push(entry)
  }
  for (const poster of posters) {
    files[fileFor('posters', poster.ticketId, poster.blob)] = [await bytes(poster.blob), { level: 0 }]
  }

  // 사진첩
  const [albums, photos, photoImages] = await Promise.all([
    db.albums.toArray(),
    db.photos.toArray(),
    db.photoImages.toArray(),
  ])
  const fullById = new Map(photoImages.map((image) => [image.photoId, image.blob]))
  const storedPhotos: StoredPhoto[] = []
  for (const { thumb, ...rest } of photos) {
    const entry: StoredPhoto = { ...rest }
    entry.thumb = fileFor('photo-thumbs', rest.id, thumb)
    files[entry.thumb] = [await bytes(thumb), { level: 0 }]
    const full = fullById.get(rest.id)
    if (full) {
      entry.full = fileFor('photos', rest.id, full)
      files[entry.full] = [await bytes(full), { level: 0 }]
    }
    storedPhotos.push(entry)
  }

  const manifest: BackupFile = {
    app: APP,
    format: FORMAT,
    createdAt: Date.now(),
    tickets: stored,
    albums,
    photos: storedPhotos,
  }
  files['backup.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2))

  const zipped = zipSync(files)
  return {
    blob: new Blob([zipped], { type: 'application/zip' }),
    name: `keeping-gem-backup-${today()}.zip`,
    count: tickets.length,
    photoCount: photos.length,
  }
}

export function markBackedUp() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
  } catch {
    // 기록을 못 남겨도 백업 파일은 이미 만들어졌다
  }
}

export function lastBackupAt(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_BACKUP_KEY))
    return value > 0 ? value : null
  } catch {
    return null
  }
}

export interface RestorePreview {
  tickets: Ticket[]
  posters: Poster[]
  albums: Album[]
  photos: Photo[]
  photoImages: PhotoImage[]
  createdAt: number
  /** 이미 이 기기에 있는 티켓 수 (백업 내용으로 바뀐다) */
  existing: number
}

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id))

function isTicket(value: unknown): value is StoredTicket {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    typeof t.category === 'string' &&
    CATEGORY_IDS.has(t.category)
  )
}

/** 백업 파일을 읽어 무엇이 들어올지 먼저 보여준다. 아직 저장하지 않는다. */
export async function readBackup(file: File): Promise<RestorePreview> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(await bytes(file))
  } catch {
    throw new Error('백업 파일이 아니거나 손상됐어요.')
  }
  const raw = entries['backup.json']
  if (!raw) throw new Error('Keeping Gem 백업 파일이 아니에요.')

  const manifest = JSON.parse(new TextDecoder().decode(raw)) as Partial<BackupFile>
  if (manifest.app !== APP || !Array.isArray(manifest.tickets)) throw new Error('Keeping Gem 백업 파일이 아니에요.')
  if ((manifest.format ?? 0) > FORMAT) throw new Error('더 새로운 버전에서 만든 백업이에요. 앱을 새로고침한 뒤 다시 해 주세요.')

  const blobOf = (path: string) => {
    const data = entries[path]
    if (!data) return undefined
    const ext = path.split('.').pop() ?? ''
    return new Blob([new Uint8Array(data)], { type: MIME[ext] ?? 'application/octet-stream' })
  }

  const tickets: Ticket[] = []
  const posters: Poster[] = []
  for (const item of manifest.tickets.filter(isTicket)) {
    const { thumb, ...rest } = item
    tickets.push({ ...rest, thumb: thumb ? blobOf(thumb) : undefined })
    const posterPath = Object.keys(entries).find((p) => p.startsWith(`posters/${item.id}.`))
    const poster = posterPath && blobOf(posterPath)
    if (poster) posters.push({ ticketId: item.id, blob: poster })
  }

  // 사진첩 (format 1 백업에는 없다 — 그 경우 빈 목록)
  const albums = (manifest.albums ?? []).filter(isAlbum).map(normalizeAlbum)
  const albumIds = new Set(albums.map((a) => a.id))
  const photos: Photo[] = []
  const photoImages: PhotoImage[] = []
  for (const item of manifest.photos ?? []) {
    if (!item?.id || !albumIds.has(item.albumId)) continue
    const { thumb, full, ...rest } = item
    const thumbBlob = thumb ? blobOf(thumb) : undefined
    if (!thumbBlob) continue
    photos.push({ ...rest, thumb: thumbBlob })
    const fullBlob = full ? blobOf(full) : undefined
    if (fullBlob) photoImages.push({ photoId: rest.id, blob: fullBlob })
  }

  const existing = (await db.tickets.bulkGet(tickets.map((t) => t.id))).filter(Boolean).length
  return { tickets, posters, albums, photos, photoImages, createdAt: manifest.createdAt ?? 0, existing }
}

/** 옛 백업은 티켓을 하나만 담았다(ticketId) — 여럿 담는 새 형식으로 옮긴다 */
function normalizeAlbum(album: Album & { ticketId?: string }): Album {
  const { ticketId, ...rest } = album
  return { ...rest, ticketIds: album.ticketIds ?? (ticketId ? [ticketId] : []) }
}

function isAlbum(value: unknown): value is Album {
  if (!value || typeof value !== 'object') return false
  const a = value as Record<string, unknown>
  return typeof a.id === 'string' && typeof a.title === 'string' && typeof a.date === 'string'
}

/**
 * 합쳐서 불러온다. 이 기기에만 있는 티켓은 그대로 두고,
 * 같은 티켓(같은 id)은 백업 내용으로 바꾼다 — 지우는 것은 없다.
 */
export async function applyBackup({
  tickets,
  posters,
  albums,
  photos,
  photoImages,
}: RestorePreview): Promise<void> {
  await db.transaction('rw', db.tickets, db.posters, db.albums, db.photos, db.photoImages, async () => {
    await db.tickets.bulkPut(tickets)
    await db.posters.bulkPut(posters)
    await db.albums.bulkPut(albums)
    await db.photos.bulkPut(photos)
    await db.photoImages.bulkPut(photoImages)
  })
}
