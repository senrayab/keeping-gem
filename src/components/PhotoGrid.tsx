import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Photo } from '@/db/db'
import { useObjectUrl } from '@/hooks/useObjectUrl'

function Thumb({ photo, onOpen }: { photo: Photo; onOpen: (photo: Photo) => void }) {
  const url = useObjectUrl(photo.thumb)
  return (
    <button className="grid__item" onClick={() => onOpen(photo)} aria-label="사진 크게 보기">
      {url && <img src={url} alt="" loading="lazy" />}
    </button>
  )
}

export function PhotoGrid({ onOpen }: { onOpen: (photo: Photo) => void }) {
  const photos = useLiveQuery(() => db.photos.orderBy('createdAt').reverse().toArray(), [])

  if (!photos) return null
  if (!photos.length) return <p className="empty">아직 사진이 없어요. 촬영하거나 앨범에서 골라 보세요.</p>

  return (
    <div className="grid">
      {photos.map((photo) => (
        <Thumb key={photo.id} photo={photo} onOpen={onOpen} />
      ))}
    </div>
  )
}
