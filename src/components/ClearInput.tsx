import type { InputHTMLAttributes, RefObject } from 'react'

/**
 * 오른쪽 끝에 지우기(×)가 붙은 입력칸.
 *
 * 안드로이드 크롬은 입력칸에 기본 지우기 단추를 주지 않는다(삼성 인터넷에는 있다).
 * 길게 쓴 글을 고칠 때 한 글자씩 지우는 일이 없도록 직접 붙인다.
 */
interface ClearInputProps extends InputHTMLAttributes<HTMLInputElement> {
  value: string
  onClear: () => void
  inputRef?: RefObject<HTMLInputElement>
}

export function ClearInput({ value, onClear, inputRef, ...props }: ClearInputProps) {
  return (
    <span className="input-wrap">
      <input {...props} ref={inputRef} value={value} />
      {value !== '' && (
        <button
          type="button"
          className="input-clear"
          // 손가락을 떼기 전에 지운다 — 칸에서 손이 빠져 키보드가 내려가는 것을 막는다
          onPointerDown={(e) => {
            e.preventDefault()
            onClear()
          }}
          aria-label="지우기"
          tabIndex={-1}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" />
          </svg>
        </button>
      )}
    </span>
  )
}
