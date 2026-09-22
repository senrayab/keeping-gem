import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** 켜 둔 채로 쓰는 앱이라, 새 배포를 이 간격으로 확인한다. */
const CHECK_INTERVAL = 60 * 1000

/**
 * 새 빌드가 배포되면 하단에 새로고침 안내를 띄운다.
 *
 * 서비스 워커가 새 버전을 미리 받아 대기시켜 두고(needRefresh),
 * 사용자가 버튼을 누르면 그 워커로 바꿔 끼운 뒤 다시 연다.
 */
export function UpdateToast() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, reg) => setRegistration(reg),
  })

  useEffect(() => {
    if (!registration) return
    const check = () => {
      if (navigator.onLine) void registration.update()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    const timer = window.setInterval(check, CHECK_INTERVAL)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [registration])

  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!needRefresh) return
    // 붙은 다음 프레임에 클래스를 줘야 올라오는 애니메이션이 보인다
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [needRefresh])

  if (!needRefresh) return null

  return (
    <div className={`toast${visible ? ' show' : ''}`} role="status">
      <span>최신 버전이 나왔어요. 새로고침하면 반영됩니다.</span>
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        새로고침
      </button>
    </div>
  )
}
