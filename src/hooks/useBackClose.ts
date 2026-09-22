import { useEffect, useRef } from 'react'

/*
 * 안드로이드 뒤로 가기(와 iOS 스와이프 뒤로)로 겹쳐 뜬 화면을 닫는다.
 *
 * 화면이 뜰 때 기록을 하나 쌓고, 뒤로 가기가 오면 가장 위의 화면만 닫는다.
 * 버튼으로 닫을 때는 쌓아 둔 기록을 직접 걷어낸다 — 그때 오는 popstate는
 * 우리가 부른 것이므로 무시한다.
 *
 * history.back()은 바로 일어나지 않고, 도착할 곳은 '부른 시점'의 앞 칸으로 정해진다.
 * 그래서 입력 화면을 닫자마자 상세보기를 여는 경우(저장 직후)에 back이 끝나기 전에
 * 새 기록을 쌓으면, 방금 쌓은 칸이 앞으로 밀려나 뒤로 가기가 한 칸씩 어긋난다.
 * back이 도착할 때까지 새 기록 쌓기를 미뤄 둔다.
 */
const stack: symbol[] = []
const handlers = new Map<symbol, () => void>()
let ignore = 0
const afterBack: (() => void)[] = []

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignore > 0) {
      ignore -= 1
      if (ignore === 0) afterBack.splice(0).forEach((run) => run())
      return
    }
    const top = stack[stack.length - 1]
    if (top) handlers.get(top)?.()
  })
}

export function useBackClose(onClose: () => void) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const id = Symbol('overlay')
    let pushed = false
    let popped = false

    const push = () => {
      history.pushState({ overlay: true }, '')
      pushed = true
    }
    if (ignore > 0) afterBack.push(push)
    else push()

    stack.push(id)
    handlers.set(id, () => {
      popped = true
      closeRef.current()
    })

    return () => {
      stack.splice(stack.indexOf(id), 1)
      handlers.delete(id)
      if (!pushed) {
        // 쌓기도 전에 닫혔다 — 미뤄 둔 일만 거둔다
        afterBack.splice(afterBack.indexOf(push), 1)
      } else if (!popped) {
        ignore += 1
        history.back()
      }
    }
  }, [])
}
