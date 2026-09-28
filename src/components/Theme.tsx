import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * 스킨(테마).
 *
 * `night`는 처음부터 있던 밤하늘, `receipt`는 종이 영수증이다.
 * 고른 스킨은 기기에 기억해 두고, `<html data-theme>`에 적어 색을 갈아끼운다.
 * 첫 화면이 깜빡이지 않도록 index.html에서도 같은 값을 미리 읽어 적어 둔다.
 */
export type Theme = 'night' | 'receipt'

const KEY = 'keeping-gem:theme'

/*
 * 영수증 스킨의 글꼴. 밤하늘만 쓰는 사람은 받을 일이 없도록, 스킨을 고른 뒤에 불러온다.
 * (한 번 받은 글꼴은 서비스 워커가 갖고 있어 비행기 모드에서도 같은 모습이다)
 */
const FONTS =
  'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Instrument+Serif&family=Nanum+Pen+Script&family=Noto+Serif+KR:wght@400;500&display=swap'

function loadSkinFonts() {
  if (document.getElementById('skin-fonts')) return
  const link = document.createElement('link')
  link.id = 'skin-fonts'
  link.rel = 'stylesheet'
  link.href = FONTS
  document.head.append(link)
}

/** 휴대폰 상태 표시줄 색 — 스킨의 배경색과 맞춘다 */
const BAR_COLOR: Record<Theme, string> = { night: '#07060d', receipt: '#e9e6e0' }

export const THEMES: { id: Theme; label: string; note: string }[] = [
  { id: 'night', label: '밤하늘', note: '티켓 한 장이 별 하나. 연도별 하늘을 거닐어요.' },
  { id: 'receipt', label: '영수증', note: '티켓 한 장이 종이 한 장. 클립에 물린 포스터로 봐요.' },
]

const read = (): Theme => {
  try {
    return localStorage.getItem(KEY) === 'receipt' ? 'receipt' : 'night'
  } catch {
    return 'night'
  }
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: 'night',
  setTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, set] = useState<Theme>(read)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme])
    if (theme === 'receipt') loadSkinFonts()
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    set(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // 기억하지 못해도 이번 화면은 바뀐 스킨으로 보인다
    }
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
