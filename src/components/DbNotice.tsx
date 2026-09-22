import { useEffect, useState } from 'react'
import { dbNotice, type DbNotice as Notice } from '@/db/db'

/** 저장소를 열지 못해 기다리는 중이거나, 다른 곳에서 새 버전이 열렸을 때 위에 띄우는 안내 */
export function DbNotice() {
  const [notice, setNotice] = useState<Notice>(dbNotice)

  useEffect(() => {
    const onNotice = (e: Event) => setNotice((e as CustomEvent<Notice>).detail)
    window.addEventListener('db-notice', onNotice)
    return () => window.removeEventListener('db-notice', onNotice)
  }, [])

  if (!notice) return null

  return (
    <div className="db-notice" role="alert">
      {notice === 'blocked' ? (
        <p>
          <strong>이전 버전의 앱이 다른 곳에 열려 있어요.</strong>
          <br />
          크롬·삼성 인터넷에 열린 Keeping Gem 탭을 닫으면 이어서 저장됩니다. 쓰던 내용은 그대로 있어요.
        </p>
      ) : (
        <>
          <p>
            <strong>다른 곳에서 새 버전이 열렸어요.</strong>
            <br />
            새로고침하면 이어서 쓸 수 있어요. 쓰던 내용은 보관돼 있어요.
          </p>
          <button type="button" onClick={() => location.reload()}>
            새로고침
          </button>
        </>
      )}
    </div>
  )
}
