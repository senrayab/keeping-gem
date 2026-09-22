import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

// 저장 공간이 모자랄 때 브라우저가 티켓을 먼저 지우지 않도록 '지우지 말아 달라'고 청한다.
// 홈 화면에 설치한 앱이면 대개 받아들여진다. 거절돼도 쓰는 데는 지장이 없다.
void navigator.storage?.persist?.().catch(() => false)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
