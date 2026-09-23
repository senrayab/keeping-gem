import Lenis from 'lenis'
import { useEffect } from 'react'

/*
 * 밤하늘을 넘길 때의 손맛.
 *
 * 손가락을 그대로 따라붙지 않고 아주 살짝 늦게 따라온다 — 처음에는 부드럽게 끌려오다가
 * 뒤로 갈수록 따라잡으며 미끄러진다. 별이 떠 있는 하늘을 밀어 보는 느낌에 가깝다.
 *
 * 겹친 화면(상세보기·사진첩 등)이 뜨면 멈춘다. 그 화면들은 저마다 스크롤을 갖고 있고,
 * 뒤 화면은 어차피 잠가 두기 때문이다(useScrollLock).
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      // 손을 뗀 뒤 미끄러지는 거리 — 짧게 둬야 가볍다
      duration: 0.6,
      // 처음엔 천천히, 뒤로 갈수록 빠르게 따라잡는 곡선
      easing: (t) => 1 - Math.pow(1 - t, 3),
      // 손가락을 따라오는 정도 — 높을수록 바짝 따라와 가볍게 느껴진다
      syncTouch: true,
      syncTouchLerp: 0.3,
      touchInertiaExponent: 1.2,
      wheelMultiplier: 1,
      /*
       * 겹친 화면은 저마다 스크롤을 갖고 있다(사진첩·설정·입력·지도).
       * 그 안에서는 손대지 않아야 그 화면이 제 스크롤로 움직인다.
       */
      prevent: (node) =>
        Boolean(node.closest?.('.sheet, .album-view, .detail, .map-viewer, .photo-detail, .poster-viewer')),
    })

    let frame = 0
    const tick = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    // 겹친 화면이 열리고 닫힐 때 멈추고 다시 굴린다
    const stop = () => lenis.stop()
    const start = () => lenis.start()
    window.addEventListener('overlay-open', stop)
    window.addEventListener('overlay-close', start)

    // 연도 줄에서 건너뛸 때도 같은 손맛으로 움직이도록 열어 둔다
    window.__lenis = lenis

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('overlay-open', stop)
      window.removeEventListener('overlay-close', start)
      delete window.__lenis
      lenis.destroy()
    }
  }, [])
}
