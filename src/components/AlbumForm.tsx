import { Check } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type FormEvent } from 'react'
import { db, saveAlbum, type Album } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { formatDate, today } from '@/lib/format'
import { ClearInput } from './ClearInput'
import { useToast } from './Toast'

interface AlbumFormProps {
  album?: Album
  onClose: () => void
  onSaved: (id: string) => void
}

/**
 * 사진첩 만들기·고치기.
 *
 * 하루짜리도 있고 이틀 이상 이어지는 일정도 있다(2박 3일 콘서트 등).
 * 그런 경우 하루씩 나누지 않고 한 사진첩에 모아 두고, 그날들의 티켓을 함께 건다.
 */
export function AlbumForm({ album, onClose, onSaved }: AlbumFormProps) {
  useBackClose(onClose)
  useScrollLock()
  const toast = useToast()
  const tickets = useLiveQuery(() => db.tickets.orderBy('date').reverse().toArray(), [])

  const [title, setTitle] = useState(album?.title ?? '')
  const [date, setDate] = useState(album?.date ?? today())
  const [endDate, setEndDate] = useState(album?.endDate ?? '')
  const [several, setSeveral] = useState(Boolean(album?.endDate))
  const [ticketIds, setTicketIds] = useState<string[]>(album?.ticketIds ?? [])
  const endRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  /*
   * 시작한 날을 고르면 끝나는 날 달력을 이어서 연다.
   * 창이 닫히고 다시 눌러야 하면 '여러 날'을 고른 흐름이 한 번 끊긴다.
   */
  const pickStart = (value: string) => {
    setDate(value)
    if (!several) return
    // 끝나는 날이 앞서 있으면 시작일에 맞춰 둔다
    if (!endDate || endDate < value) setEndDate(value)
    window.setTimeout(() => {
      const input = endRef.current
      if (!input) return
      try {
        input.showPicker()
      } catch {
        // 달력을 바로 열 수 없는 기기에서는 칸으로 옮겨만 준다
        input.focus()
      }
    }, 120)
  }

  const toggleTicket = (id: string) =>
    setTicketIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      toast('사진첩 이름을 적어 주세요.')
      return
    }
    // 끝나는 날이 시작일보다 앞이면 사람이 잘못 고른 것이다
    if (several && endDate && endDate < date) {
      toast('끝나는 날이 시작한 날보다 앞이에요.')
      return
    }
    setSaving(true)
    try {
      const id = await saveAlbum(
        {
          title: title.trim(),
          date,
          endDate: several && endDate && endDate !== date ? endDate : undefined,
          ticketIds,
        },
        album?.id,
      )
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

        <div className="field">
          <span>날짜</span>
          <div className="chips">
            <button
              type="button"
              className={`chip${several ? '' : ' is-active'}`}
              onClick={() => {
                setSeveral(false)
                setEndDate('')
              }}
            >
              하루
            </button>
            <button
              type="button"
              className={`chip${several ? ' is-active' : ''}`}
              onClick={() => {
                setSeveral(true)
                if (!endDate) setEndDate(date)
              }}
            >
              여러 날
            </button>
          </div>
          <div className={several ? 'field-row' : undefined}>
            <input
              type="date"
              value={date}
              required
              onChange={(e) => pickStart(e.target.value)}
              aria-label="시작한 날"
            />
            {several && (
              <input
                ref={endRef}
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="끝나는 날"
              />
            )}
          </div>
        </div>

        <div className="field">
          <span>이 사진첩의 티켓 {ticketIds.length > 0 && `· ${ticketIds.length}장`}</span>
          {tickets?.length ? (
            <ul className="ticket-pick">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    className={`ticket-pick__item${ticketIds.includes(ticket.id) ? ' is-on' : ''}`}
                    onClick={() => toggleTicket(ticket.id)}
                    aria-pressed={ticketIds.includes(ticket.id)}
                  >
                    <Thumb blob={ticket.thumb} title={ticket.title} />
                    <span className="ticket-pick__text">
                      <strong>{ticket.title}</strong>
                      <small>{formatDate(ticket.date)}</small>
                    </span>
                    <span className="ticket-pick__check" aria-hidden="true">
                      {ticketIds.includes(ticket.id) && <Check aria-hidden="true" />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field__hint">아직 티켓이 없어요. 티켓 없이도 사진첩을 만들 수 있어요.</p>
          )}
        </div>

        <div className="sheet__foot">
          <button type="submit" className="btn btn--glow" disabled={saving}>
            {saving ? '저장 중…' : album ? '수정 완료' : '만들고 사진 넣기'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Thumb({ blob, title }: { blob?: Blob; title: string }) {
  const url = useObjectUrl(blob)
  return (
    <span className="ticket-pick__thumb">{url ? <img src={url} alt="" /> : <span>{title.slice(0, 1)}</span>}</span>
  )
}
