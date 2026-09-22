import { useMemo, type CSSProperties } from 'react'
import { seeded } from '@/lib/seed'

/** 뒤에 깔리는 잔별과 흐릿한 빛망울. 늘 같은 자리에 뜨도록 고정된 씨앗을 쓴다. */
export function Starfield() {
  const dots = useMemo(() => {
    const rand = seeded('starfield')
    return Array.from({ length: 56 }, () => ({
      left: `${rand() * 100}%`,
      top: `${rand() * 100}%`,
      '--s': `${1 + rand() * 1.8}px`,
      '--delay': `${-rand() * 6}s`,
    }))
  }, [])

  return (
    <div className="starfield" aria-hidden="true">
      <span className="bokeh bokeh--1" />
      <span className="bokeh bokeh--2" />
      <span className="bokeh bokeh--3" />
      {dots.map((style, i) => (
        <span key={i} className="dot" style={style as CSSProperties} />
      ))}
    </div>
  )
}
