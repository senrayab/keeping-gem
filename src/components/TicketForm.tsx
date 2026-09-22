import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { db, saveTicket, type Ticket } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useDraft } from '@/hooks/useDraft'
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
  useScrollLock()
  const toast = useToast()

  // 새 티켓이면 쓰던 내용을 기기에 맡겨 두고, 다시 열면 이어서 쓴다
  const [fields, setFields, clearDraft] = useDraft(!ticket, {
    title: ticket?.title ?? '',
    category: (ticket?.category ?? 'concert') as CategoryId,
    date: ticket?.date ?? today(),
    time: ticket?.time ?? '',
    venue: ticket?.venue ?? '',
    seat: ticket?.seat ?? '',
    price: ticket?.price != null ? String(ticket.price) : '',
    memo: ticket?.memo ?? '',
  })
  const { title, category, date, time, venue, seat, price, memo } = fields

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
      if (!ticket) clearDraft()
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
          {/* 포스터 칸 자체를 누르면 바로 앨범이 열린다 */}
          <button
            type="button"
            className="poster-pick__frame"
            onClick={() => albumRef.current?.click()}
            disabled={converting}
            aria-label={previewUrl ? '앨범에서 포스터 바꾸기' : '앨범에서 포스터 고르기'}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="포스터 미리보기" />
            ) : (
              <span className="poster-pick__hint">
                {converting ? '변환 중…' : (
                  <>
                    눌러서 포스터 고르기
                    <small>앨범이 열려요</small>
                  </>
                )}
              </span>
            )}
          </button>
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
          <input ref={titleRef} value={title} onChange={(e) => setFields({ title: e.target.value })} placeholder="어떤 공연이었나요?" />
        </label>

        <div className="field">
          <span>종류</span>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`chip${c.id === category ? ' is-active' : ''}`}
                onClick={() => setFields({ category: c.id })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>날짜</span>
            <input type="date" value={date} required onChange={(e) => setFields({ date: e.target.value })} />
          </label>
          <label className="field">
            <span>시간</span>
            <input type="time" value={time} onChange={(e) => setFields({ time: e.target.value })} />
          </label>
        </div>

        <label className="field">
          <span>장소</span>
          <input value={venue} onChange={(e) => setFields({ venue: e.target.value })} placeholder="올림픽공원 KSPO DOME" />
        </label>

        <div className="field-row">
          <label className="field">
            <span>좌석</span>
            <input value={seat} onChange={(e) => setFields({ seat: e.target.value })} placeholder="1층 A구역 12열 7번" />
          </label>
          <label className="field">
            <span>금액</span>
            <input
              inputMode="numeric"
              value={priceDisplay}
              onChange={(e) => setFields({ price: e.target.value.replace(/\D/g, '') })}
              placeholder="0"
            />
          </label>
        </div>

        <label className="field">
          <span>그날의 한마디</span>
          <textarea value={memo} rows={3} onChange={(e) => setFields({ memo: e.target.value })} placeholder="앵콜 때 다 같이 떼창한 순간" />
        </label>

        <div className="sheet__foot">
          <button type="submit" className="btn btn--glow" disabled={saving || converting}>
            {saving ? '저장 중…' : ticket ? '수정 완료' : '하늘에 띄우기'}
          </button>
        </div>
      </form>
    </div>
  )
}
