import { UpdateToast } from './components/UpdateToast'

export function App() {
  return (
    <>
      <header className="app-header">
        <h1>Keeping Gem</h1>
      </header>

      <main className="app-main">
        <p className="empty">아직 아무것도 없어요.</p>
      </main>

      <UpdateToast />
    </>
  )
}
