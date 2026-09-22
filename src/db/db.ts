import Dexie, { type Table } from 'dexie'
import type { ProcessedImage } from '@/lib/image'
import type { CategoryId } from '@/lib/categories'

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
  seat?: string
  /** 원 단위 */
  price?: number
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

export type TicketInput = Pick<Ticket, 'title' | 'category' | 'date' | 'time' | 'venue' | 'seat' | 'price' | 'memo'>

class KeepingGemDB extends Dexie {
  tickets!: Table<Ticket, string>
  posters!: Table<Poster, string>

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
  }
}

export const db = new KeepingGemDB()

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

export async function deleteTicket(id: string): Promise<void> {
  await db.transaction('rw', db.tickets, db.posters, async () => {
    await db.tickets.delete(id)
    await db.posters.delete(id)
  })
}
