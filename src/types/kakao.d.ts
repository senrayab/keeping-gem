/**
 * 카카오맵 JavaScript SDK 중 이 앱이 쓰는 부분만 적어 둔 타입.
 * 공식 타입 꾸러미를 쓰지 않는 까닭은, 쓰는 기능이 지도 한 장과 장소 검색뿐이기 때문이다.
 */
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps }
  }
}

export interface KakaoLatLng {
  getLat(): number
  getLng(): number
}

export interface KakaoMap {
  setCenter(position: KakaoLatLng): void
  relayout(): void
}

/** 장소 검색 결과 한 건 (x=경도, y=위도 — 문자열로 온다) */
export interface KakaoPlace {
  id: string
  place_name: string
  address_name: string
  road_address_name: string
  category_group_name: string
  x: string
  y: string
}

export interface KakaoMaps {
  load(callback: () => void): void
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number; draggable?: boolean }) => KakaoMap
  Marker: new (options: { position: KakaoLatLng; map?: KakaoMap }) => unknown
  services: {
    Places: new () => {
      keywordSearch(
        query: string,
        callback: (data: KakaoPlace[], status: string) => void,
        options?: { size?: number },
      ): void
    }
    Status: { OK: string; ZERO_RESULT: string; ERROR: string }
  }
}
