/** 파일을 기기에 내려받는다 (안드로이드는 '다운로드' 폴더, 갤러리에서도 보인다) */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 바로 풀면 일부 브라우저가 받기 전에 주소를 잃는다
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** 이 기기가 공유 시트로 파일을 넘길 수 있는지 (카카오톡·인스타그램 등) */
export function canShareFiles(sample: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [sample] })
}

/** 공유 시트를 사용자가 그냥 닫은 경우 — 오류로 알리지 않는다 */
export const isShareCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
