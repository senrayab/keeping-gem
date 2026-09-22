import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'

interface ConfirmDialogProps {
  title: string
  message?: string
  /** 되돌릴 수 없는 일이면 true — 버튼이 붉게 된다 */
  danger?: boolean
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/*
 * 앱 안에서 그리는 확인창.
 *
 * 브라우저의 기본 확인창(window.confirm)은 위에 주소와 '내용:'을 붙여 보여준다.
 * 그 문구는 없앨 수 없고, 앱 한가운데 낯선 회색 상자가 뜨는 것도 어울리지 않는다.
 */
export function ConfirmDialog({ title, message, danger, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  useBackClose(onCancel)
  useScrollLock()

  return (
    <div className="confirm" role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="confirm__box" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        <div className="confirm__row">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--glow'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
