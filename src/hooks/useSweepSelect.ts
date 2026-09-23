import { useCallback, useRef, useState } from 'react'

/*
 * 꾹 눌러 고르기 시작하고, 손가락을 끌어 여러 개를 고른다.
 *
 * 지나온 길을 되짚어 오면 방금 고른 것이 풀린다 — 손이 미끄러져 엉뚱한 것을
 * 골랐을 때 손을 떼지 않고 바로 되돌릴 수 있다. (지나온 순서를 쌓아 두고,
 * 바로 앞의 것으로 돌아오면 마지막 하나를 되돌린다)
 */
const HOLD_MS = 420
/** 이만큼 움직이면 '꾹 누르기'가 아니라 넘기려는 것으로 본다 */
const MOVE_TOLERANCE = 10

interface Options {
  /** 손가락 아래에 있는 것의 id를 찾는다 (없으면 undefined) */
  idAt: (x: number, y: number) => string | undefined
}

export function useSweepSelect({ idAt }: Options) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const hold = useRef<number>()
  const start = useRef<{ x: number; y: number } | null>(null)
  const sweeping = useRef(false)
  /** 이번에 끌면서 지나온 순서 — 되짚어 올 때 쓴다 */
  const trail = useRef<string[]>([])

  const clearHold = () => {
    window.clearTimeout(hold.current)
    hold.current = undefined
  }

  const add = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const drop = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const stop = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
    sweeping.current = false
    trail.current = []
  }, [])

  /** 항목 위에서 손가락을 댔을 때 */
  const onPointerDown = useCallback(
    (id: string, event: { clientX: number; clientY: number }) => {
      start.current = { x: event.clientX, y: event.clientY }
      if (selecting) {
        // 이미 고르는 중이면 바로 끌어 고를 수 있다
        sweeping.current = true
        trail.current = [id]
        toggle(id)
        return
      }
      clearHold()
      hold.current = window.setTimeout(() => {
        setSelecting(true)
        sweeping.current = true
        trail.current = [id]
        add(id)
        navigator.vibrate?.(12)
      }, HOLD_MS)
    },
    [add, selecting, toggle],
  )

  /** 손가락을 끌 때 — 바탕(목록 전체)에 걸어 둔다 */
  const onPointerMove = useCallback(
    (event: { clientX: number; clientY: number }) => {
      if (hold.current && start.current) {
        const moved = Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y)
        if (moved > MOVE_TOLERANCE) clearHold()
      }
      if (!sweeping.current) return

      const id = idAt(event.clientX, event.clientY)
      if (!id) return
      const path = trail.current
      if (path[path.length - 1] === id) return

      if (path.length >= 2 && path[path.length - 2] === id) {
        // 되짚어 왔다 — 방금 고른 것을 되돌린다
        const undo = path.pop()
        if (undo) drop(undo)
      } else {
        path.push(id)
        add(id)
      }
    },
    [add, drop, idAt],
  )

  const onPointerUp = useCallback(() => {
    clearHold()
    sweeping.current = false
    start.current = null
  }, [])

  return { selecting, selected, sweeping, toggle, stop, onPointerDown, onPointerMove, onPointerUp }
}
