import type { KakaoMaps, KakaoPlace } from '@/types/kakao'

/*
 * 카카오맵 SDK는 장소를 찾거나 지도를 열 때에만 불러온다.
 *
 * 앱은 인터넷 없이도 열려야 하므로 첫 화면에서는 부르지 않는다.
 * 불러오지 못하면(비행기 모드 등) 오류를 던지고, 부른 쪽에서 안내만 띄운다.
 */

/*
 * 이 키는 웹 앱 특성상 앱 코드에 들어가 공개된다 — 카카오도 그걸 전제로 만들어져 있고,
 * 카카오 개발자 사이트에 등록한 주소(senrayab.github.io, localhost:5173)에서만 동작한다.
 * 키를 바꾸려면 여기만 고치면 된다.
 */
const APP_KEY = '9b7b0046f76bcaaba8fc6c574671ecec'
const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&libraries=services&autoload=false`
const LOAD_TIMEOUT = 8000

let loading: Promise<KakaoMaps> | null = null

export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao.maps)
  if (loading) return loading

  loading = new Promise<KakaoMaps>((resolve, reject) => {
    const fail = (message: string) => {
      loading = null
      reject(new Error(message))
    }
    const timer = window.setTimeout(() => fail('지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'), LOAD_TIMEOUT)

    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => {
      // autoload=false라 여기서 직접 켠다 — 그래야 준비가 끝난 시점을 알 수 있다
      window.kakao?.maps.load(() => {
        window.clearTimeout(timer)
        if (window.kakao) resolve(window.kakao.maps)
        else fail('지도를 불러오지 못했어요.')
      })
    }
    script.onerror = () => {
      window.clearTimeout(timer)
      script.remove()
      fail('지도를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')
    }
    document.head.appendChild(script)
  })

  return loading
}

/** 키워드로 장소를 찾는다. 결과가 없으면 빈 배열. */
export async function searchPlaces(query: string): Promise<KakaoPlace[]> {
  const maps = await loadKakaoMaps()
  const places = new maps.services.Places()
  return new Promise((resolve, reject) => {
    places.keywordSearch(
      query,
      (data, status) => {
        if (status === maps.services.Status.OK) resolve(data)
        else if (status === maps.services.Status.ZERO_RESULT) resolve([])
        else reject(new Error('장소를 찾지 못했어요.'))
      },
      { size: 8 },
    )
  })
}

/** 카카오맵 앱·웹에서 열 주소 (길찾기나 주변 정보는 그쪽이 낫다) */
export const kakaoMapLink = (name: string, lat: number, lng: number) =>
  `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`
