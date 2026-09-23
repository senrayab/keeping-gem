import { X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { db, saveTicket, type Ticket } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useDraft } from '@/hooks/useDraft'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import { CURRENCIES, currencyOf, DEFAULT_CURRENCY, type CurrencyId } from '@/lib/currencies'
import { today } from '@/lib/format'
import { searchPlaces } from '@/lib/kakao'
import { processImage, type ProcessedImage } from '@/lib/image'
import type { KakaoPlace } from '@/types/kakao'
import { ClearInput } from './ClearInput'
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
    lat: ticket?.lat,
    lng: ticket?.lng,
    address: ticket?.address,
    seat: ticket?.seat ?? '',
    price: ticket?.price != null ? String(ticket.price) : '',
    currency: (ticket?.currency ?? DEFAULT_CURRENCY) as CurrencyId,
    memo: ticket?.memo ?? '',
  })
  const { title, category, date, time, venue, lat, lng, address, seat, price, currency, memo } = fields

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

  // 열자마자 칸에 커서를 두지 않는다 — 키보드가 올라와 화면 절반을 가린다.
  // 어디부터 적을지는 사람이 고른다.

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

  /*
   * 장소 자동완성.
   *
   * 직접 고쳐 적기 시작했을 때만 찾는다 — 수정 화면을 열자마자 이미 적힌 장소로
   * 검색이 돌아 목록이 튀어나오면 성가시다. 고른 장소만 좌표를 갖는다.
   */
  const [places, setPlaces] = useState<KakaoPlace[]>([])
  const [placeError, setPlaceError] = useState<string>()
  const typingVenue = useRef(false)

  useEffect(() => {
    const query = venue.trim()
    if (!typingVenue.current || query.length < 2) {
      setPlaces([])
      return
    }
    // 먼저 보낸 검색이 늦게 도착해 이미 지운 칸에 목록을 다시 채우는 일이 없게 한다
    let alive = true
    const timer = window.setTimeout(() => {
      searchPlaces(query)
        .then((found) => {
          if (!alive) return
          setPlaces(found)
          setPlaceError(undefined)
        })
        .catch((e: Error) => {
          if (!alive) return
          setPlaces([])
          setPlaceError(e.message)
        })
    }, 350)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [venue])

  const pickPlace = (place: KakaoPlace) => {
    typingVenue.current = false
    setPlaces([])
    setFields({
      venue: place.place_name,
      lat: Number(place.y),
      lng: Number(place.x),
      address: place.road_address_name || place.address_name || undefined,
    })
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
      const amount = Number(price)
      const id = await saveTicket(
        {
          title: title.trim(),
          category,
          date,
          time: time || undefined,
          venue: venue.trim() || undefined,
          lat: venue.trim() ? lat : undefined,
          lng: venue.trim() ? lng : undefined,
          address: venue.trim() ? address : undefined,
          seat: seat.trim() || undefined,
          price: price && Number.isFinite(amount) ? amount : undefined,
          currency: price ? currency : undefined,
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

  /*
   * 금액 입력: 숫자와(통화에 따라) 소수점만 받는다.
   * 정수 부분에만 천 단위 쉼표를 넣고, 찍는 중인 소수점('12.')은 그대로 둔다.
   */
  const decimals = currencyOf(currency).decimals
  const onPrice = (value: string) => {
    let next = value.replace(decimals > 0 ? /[^\d.]/g : /\D/g, '')
    const dot = next.indexOf('.')
    // 소수점은 하나만, 소수 자릿수는 통화에 맞춰 자른다
    if (dot >= 0) next = `${next.slice(0, dot)}.${next.slice(dot + 1).replace(/\./g, '').slice(0, decimals)}`
    setFields({ price: next })
  }
  const [whole, fraction] = price.split('.')
  const priceDisplay = price
    ? Number(whole || 0).toLocaleString('ko-KR') + (fraction === undefined ? '' : `.${fraction}`)
    : ''

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={ticket ? '티켓 수정' : '티켓 추가'}>
      <form className="sheet__body" onSubmit={(e) => void submit(e)}>
        <header className="sheet__head">
          {/* 취소는 다른 화면의 닫기와 같은 오른쪽 위에 둔다 */}
          <span className="sheet__spacer" />
          <h2>{ticket ? '티켓 수정' : '새 티켓'}</h2>
          <button type="button" className="btn btn--ghost btn--small btn--icon" onClick={onClose} aria-label="취소">
            <X aria-hidden="true" />
          </button>
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
          <ClearInput
            inputRef={titleRef}
            value={title}
            onChange={(e) => setFields({ title: e.target.value })}
            onClear={() => {
              setFields({ title: '' })
              titleRef.current?.focus()
            }}
            placeholder="어떤 공연이었나요?"
          />
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

        <div className="field">
          <span>장소</span>
          <ClearInput
            value={venue}
            onChange={(e) => {
              typingVenue.current = true
              // 직접 고쳐 적으면 앞서 고른 장소의 좌표는 더 맞지 않는다
              setFields({ venue: e.target.value, lat: undefined, lng: undefined, address: undefined })
            }}
            onClear={() => {
              typingVenue.current = false
              setPlaces([])
              setFields({ venue: '', lat: undefined, lng: undefined, address: undefined })
            }}
            placeholder="공연장 이름을 치면 찾아드려요"
            aria-label="장소"
          />
          {lat != null && <p className="field__hint">{address ?? '지도에서 고른 장소예요'} · 상세보기에서 지도로 볼 수 있어요</p>}
          {placeError && <p className="field__hint">{placeError}</p>}
          {places.length > 0 && (
            <ul className="suggest">
              {places.map((place) => (
                <li key={place.id}>
                  {/* 손가락을 떼기 전(pointerdown)에 고른다 — 그 뒤에 목록이 닫혀도 놓치지 않게 */}
                  <button type="button" onPointerDown={() => pickPlace(place)}>
                    <strong>{place.place_name}</strong>
                    <span>{place.road_address_name || place.address_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span>좌석</span>
            <ClearInput
              value={seat}
              onChange={(e) => setFields({ seat: e.target.value })}
              onClear={() => setFields({ seat: '' })}
              placeholder="1층 A구역 12열 7번"
            />
          </label>
          <div className="field">
            <span>금액</span>
            <div className="money">
              <select
                className="money__currency"
                value={currency}
                onChange={(e) => setFields({ currency: e.target.value as CurrencyId })}
                aria-label="통화"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.symbol}
                  </option>
                ))}
              </select>
              <input
                className="money__input"
                inputMode={decimals > 0 ? 'decimal' : 'numeric'}
                value={priceDisplay}
                onChange={(e) => onPrice(e.target.value)}
                placeholder="0"
                aria-label="금액"
              />
            </div>
          </div>
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
