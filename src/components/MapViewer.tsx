import { useEffect, useRef, useState } from 'react'
import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'
import { kakaoMapLink, loadKakaoMaps } from '@/lib/kakao'

interface MapViewerProps {
  venue: string
  address?: string
  lat: number
  lng: number
  onClose: () => void
}

/** 그날 갔던 장소를 지도로 보여준다. 상세보기 위에 화면 가득 뜬다. */
export function MapViewer({ venue, address, lat, lng, onClose }: MapViewerProps) {
  useBackClose(onClose)
  useScrollLock()
  const box = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let alive = true
    loadKakaoMaps()
      .then((maps) => {
        if (!alive || !box.current) return
        const center = new maps.LatLng(lat, lng)
        const map = new maps.Map(box.current, { center, level: 4 })
        new maps.Marker({ position: center, map })
      })
      .catch((e: Error) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [lat, lng])

  return (
    <div
      className="map-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${venue} 지도`}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="map-viewer__head">
        <div>
          <h2>{venue}</h2>
          {address && <p>{address}</p>}
        </div>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          닫기
        </button>
      </header>

      <div className="map-viewer__stage">
        <div ref={box} className="map-viewer__map" />
        {error && <p className="map-viewer__error">{error}</p>}
      </div>

      <footer className="map-viewer__foot">
        <a className="btn btn--light" href={kakaoMapLink(venue, lat, lng)} target="_blank" rel="noreferrer">
          카카오맵에서 보기
        </a>
      </footer>
    </div>
  )
}
