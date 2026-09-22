import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { db, saveTicket, type Ticket } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import { today } from '@/lib/format'
import { processImage, type ProcessedImage } from '@/lib/image'
import { useToast } from './Toast'

interface TicketFormProps {
  /** 있으면 수정, 없으면 새 티켓 */
  ticket?: Ticket
  onClose: () => void
  onSaved: (id: string) => void
}

export function TicketForm({ ticket, onClose, onSaved }: TicketFormProps) {
  useBackClose(onClose)
  const toast = useToast()

  const [title, setTitle] = useState(ticket?.title ?? '')
  const [category, setCategory] = useState<CategoryId>(ticket?.category ?? 'concert')
  const [date, setDate] = useState(ticket?.date ?? today())
  const [time, setTime] = useState(ticket?.time ?? '')
  const [venue, setVenue] = useState(ticket?.venue ?? '')
  const [seat, setSeat] = useState(ticket?.seat ?? '')
  const [price, setPrice] = useState(ticket?.price != null ? String(ticket.price) : '')
  const [memo, setMemo] = useState(ticket?.memo ?? '')

  // undefined: 그대로, null: 지움, 값: 새 포스터
  const [poster, setPoster] = useState<ProcessedImage | null | undefined>(undefined)
  const [converting, setConverting] = useState(false)
  const [saving, setSaving] = useState(false)

  const savedPoster = useLiveQuery(async () => (ticket ? db.posters.get(ticket.id) : undefined), [ticket?.id])
  const previewBlob = poster === null ? undefined : (poster?.full.blob ?? savedPoster?.blob)
  const previewUrl = useObjectUrl(previewBlob)

  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ticket) titleRef.current?.focus({ preventScroll: true })
  }, [ticket])

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setConverting(true)
    try {
      setPoster(await processImage(file))
    } catch (e) {
      console.error(e)
      toast('포스터를 불러오지 못했어요.')
    } finally {
      setConverting(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      toast('제목을 적어 주세요.')
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      const digits = price.replace(/\D/g, '')
      const id = await saveTicket(
        {
          title: title.trim(),
          category,
          date,
          time: time || undefined,
          venue: venue.trim() || undefined,
          seat: seat.trim() || undefined,
          price: digits ? Number(digits) : undefined,
          memo: memo.trim() || undefined,
        },
        poster,
        ticket?.id,
      )
      toast(ticket ? '티켓을 고쳤어요.' : '새 별이 떠올랐어요.')
      onSaved(id)
    } catch (e) {
      console.error(e)
      toast('저장하지 못했어요.')
      setSaving(false)
    }
  }

  const priceDisplay = price ? Number(price.replace(/\D/g, '') || 0).toLocaleString('ko-KR') : ''

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={ticket ? '티켓 수정' : '티켓 추가'}>
      <form className="sheet__body" onSubmit={(e) => void submit(e)}>
        <header className="sheet__head">
          <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
            취소
          </button>
          <h2>{ticket ? '티켓 수정' : '새 티켓'}</h2>
          <span className="sheet__spacer" />
        </header>

        <div className="poster-pick">
          <div className="poster-pick__frame">
            {previewUrl ? (
              <img src={previewUrl} alt="포스터 미리보기" />
            ) : (
              <span className="poster-pick__hint">{converting ? '변환 중…' : '포스터를 넣어 주세요'}</span>
            )}
          </div>
          <div className="poster-pick__actions">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => cameraRef.current?.click()}>
              촬영
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => albumRef.current?.click()}>
              앨범
            </button>
            {previewUrl && (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setPoster(null)}>
                빼기
              </button>
            )}
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
          <input ref={albumRef} type="file" accept="image/*" hidden onChange={onPick} />
        </div>

        <label className="field">
          <span>제목</span>
          <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="어떤 공연이었나요?" />
        </label>

        <div className="field">
          <span>종류</span>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`chip${c.id === category ? ' is-active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>날짜</span>
            <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>시간</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>장소</span>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="올림픽공원 KSPO DOME" />
        </label>

        <div className="field-row">
          <label className="field">
            <span>좌석</span>
            <input value={seat} onChange={(e) => setSeat(e.target.value)} placeholder="1층 A구역 12열 7번" />
          </label>
          <label className="field">
            <span>금액</span>
            <input
              inputMode="numeric"
              value={priceDisplay}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
            />
          </label>
        </div>

        <label className="field">
          <span>그날의 한마디</span>
          <textarea value={memo} rows={3} onChange={(e) => setMemo(e.target.value)} placeholder="앵콜 때 다 같이 떼창한 순간" />
        </label>

        <div className="sheet__foot">
          <button type="submit" className="btn btn--glow" disabled={saving || converting}>
            {saving ? '저장 중…' : ticket ? '고치기' : '하늘에 띄우기'}
          </button>
        </div>
      </form>
    </div>
  )
}
