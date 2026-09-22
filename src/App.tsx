import { useState } from 'react'
import type { Photo } from './db/db'
import { AddPhotoBar } from './components/AddPhotoBar'
import { PhotoGrid } from './components/PhotoGrid'
import { PhotoViewer } from './components/PhotoViewer'
import { ToastProvider } from './components/Toast'
import { UpdateToast } from './components/UpdateToast'

export function App() {
  const [opened, setOpened] = useState<Photo | null>(null)

  return (
    <ToastProvider>
      <header className="app-header">
        <h1>Keeping Gem</h1>
      </header>

      <main className="app-main">
        <PhotoGrid onOpen={setOpened} />
      </main>

      <AddPhotoBar />

      {opened && <PhotoViewer photo={opened} onClose={() => setOpened(null)} />}

      <UpdateToast />
    </ToastProvider>
  )
}
