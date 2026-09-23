import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db, saveAlbum, type Album } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'
import { formatDate, today } from '@/lib/format'
import { ClearInput } from './ClearInput'
import { useToast } from './Toast'

interface AlbumFormProps {
  album?: Album
  onClose: () => void
  onSaved: (id: string) => void
}

/** 사진첩 만들기·고치기. 티켓과 이어 두면 그 티켓 상세보기에서 바로 열 수 있다. */
export function AlbumForm({ album, onClose, onSaved }: AlbumFormProps) {
  useBackClose(onClose)
  useScrollLock()
  const toast = useToast()
  const tickets = useLiveQuery(() => db.tickets.orderBy('date').reverse().toArray(), [])

  const [title, setTitle] = useState(album?.title ?? '')
  const [date, setDate] = useState(album?.date ?? today())
  const [ticketId, setTicketId] = useState(album?.ticketId ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      toast('사진첩 이름을 적어 주세요.')
      return
    }
    setSaving(true)
    try {
      const id = await saveAlbum({ title: title.trim(), date, ticketId: ticketId || undefined }, album?.id)
      onSaved(id)
    } catch (e) {
      console.error(e)
      toast('저장하지 못했어요.')
      setSaving(false)
    }
  }

  return (
    <div className="sheet sheet--over" role="dialog" aria-modal="true" aria-label={album ? '사진첩 수정' : '새 사진첩'}>
      <form className="sheet__body" onSubmit={(e) => void submit(e)}>
        <header className="sheet__head">
          <span />
          <h2>{album ? '사진첩 수정' : '새 사진첩'}</h2>
          <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
            취소
          </button>
        </header>

        <label className="field">
          <span>이름</span>
          <ClearInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onClear={() => setTitle('')}
            placeholder="도쿄 팬미팅 다녀온 날"
            autoFocus={!album}
          />
        </label>

        <label className="field">
          <span>날짜</span>
          <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        </label>

        <label className="field">
          <span>이 사진첩의 티켓 (없어도 됩니다)</span>
          <select className="select" value={ticketId} onChange={(e) => setTicketId(e.target.value)}>
            <option value="">연결 안 함</option>
            {tickets?.map((ticket) => (
              <option key={ticket.id} value={ticket.id}>
                {formatDate(ticket.date)} · {ticket.title}
              </option>
            ))}
          </select>
        </label>

        <div className="sheet__foot">
          <button type="submit" className="btn btn--glow" disabled={saving}>
            {saving ? '저장 중…' : album ? '수정 완료' : '만들고 사진 넣기'}
          </button>
        </div>
      </form>
    </div>
  )
}
