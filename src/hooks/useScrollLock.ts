import { useEffect } from 'react'

/*
 * 겹친 화면(상세보기·입력·보관함·포스터)이 떠 있는 동안 뒤의 밤하늘을 멈춘다.
 *
 * 겹친 화면 안에 더 밀 것이 없으면, 손가락으로 민 만큼이 뒤 화면으로 넘어가
 * 밤하늘이 흘러가 버린다. 그러면 닫았을 때 눌렀던 별이 제자리에 없다.
 * 화면이 여럿 겹칠 수 있으므로 몇 겹인지 세어, 마지막 한 겹이 닫힐 때 푼다.
 */
let locks = 0

if (typeof history !== 'undefined') {
  // 뒤로 가기 때 브라우저가 멋대로 스크롤을 옮기지 않게 한다 — 자리는 우리가 지킨다
  history.scrollRestoration = 'manual'
}

export function useScrollLock() {
  useEffect(() => {
    if (locks++ === 0) document.documentElement.classList.add('is-locked')
    return () => {
      if (--locks === 0) document.documentElement.classList.remove('is-locked')
    }
  }, [])
}
