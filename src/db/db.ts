import Dexie, { type Table } from 'dexie'
import type { ProcessedImage } from '@/lib/image'

/** 목록에 쓰는 정보. 썸네일만 들고 있어 목록을 그릴 때 본체가 메모리에 올라오지 않는다. */
export interface Photo {
  id: string
  createdAt: number
  thumb: Blob
  width: number
  height: number
  /** 저장된 본체 + 썸네일 바이트 */
  bytes: number
  originalBytes: number
}

/** 크게 볼 때만 꺼내는 본체 */
export interface PhotoImage {
  photoId: string
  blob: Blob
}

class KeepingGemDB extends Dexie {
  photos!: Table<Photo, string>
  images!: Table<PhotoImage, string>

  constructor() {
    super('keeping-gem')
    this.version(1).stores({
      photos: 'id, createdAt',
      images: 'photoId',
    })
  }
}

export const db = new KeepingGemDB()

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export async function addPhoto({ full, thumb, originalBytes }: ProcessedImage): Promise<void> {
  const id = uid()
  await db.transaction('rw', db.photos, db.images, async () => {
    await db.photos.add({
      id,
      createdAt: Date.now(),
      thumb: thumb.blob,
      width: full.width,
      height: full.height,
      bytes: full.blob.size + thumb.blob.size,
      originalBytes,
    })
    await db.images.add({ photoId: id, blob: full.blob })
  })
}

export async function deletePhoto(id: string): Promise<void> {
  await db.transaction('rw', db.photos, db.images, async () => {
    await db.photos.delete(id)
    await db.images.delete(id)
  })
}
