import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'

/** 포스터 전체를 화면 가득 보여준다. 아무 데나 누르거나 뒤로 가기로 닫힌다. */
export function PosterViewer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  useBackClose(onClose)
  useScrollLock()

  return (
    <div className="poster-viewer" role="dialog" aria-modal="true" aria-label={`${title} 포스터`} onClick={(e) => {
        // 이 화면은 상세보기 안에 들어 있다 — 막지 않으면 상세보기까지 함께 닫힌다
        e.stopPropagation()
        onClose()
      }}>
      <img src={url} alt={`${title} 포스터`} />
    </div>
  )
}
