import { useLiveQuery } from 'dexie-react-hooks'
import { db, deletePhoto, type Photo } from '@/db/db'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { formatBytes } from '@/lib/image'
import { useToast } from './Toast'

export function PhotoViewer({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const image = useLiveQuery(() => db.images.get(photo.id), [photo.id])
  // 본체를 읽는 동안에는 썸네일을 먼저 보여준다
  const url = useObjectUrl(image?.blob ?? photo.thumb)
  const toast = useToast()

  const remove = async () => {
    if (!window.confirm('이 사진을 삭제할까요?')) return
    await deletePhoto(photo.id)
    onClose()
    toast('삭제했어요.')
  }

  return (
    <div className="viewer" role="dialog" aria-modal="true" onClick={onClose}>
      {url && <img className="viewer__img" src={url} alt="" />}
      <div className="viewer__bar" onClick={(e) => e.stopPropagation()}>
        <span className="viewer__info">
          {photo.width}×{photo.height} · {formatBytes(photo.bytes)}
          <small> (원본 {formatBytes(photo.originalBytes)})</small>
        </span>
        <button className="btn btn--danger" onClick={() => void remove()}>
          삭제
        </button>
        <button className="btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
