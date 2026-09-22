/**
 * 올린 사진을 WebP로 변환한다.
 * - 폰 원본(수 MB)을 그대로 두면 금방 용량이 차므로 긴 변 기준으로 줄인다.
 * - 목록용 썸네일과 크게 볼 본체를 따로 만든다.
 */

/*
 * 휴대폰 화면 폭은 3배 밀도 기준으로 1200px 안팎이다.
 * 확대해서 볼 여지를 남겨 2000px로 둔다 — 이보다 크면 눈으로는 차이가 없고 용량만 는다.
 */
export const FULL_MAX_EDGE = 2000
export const FULL_QUALITY = 0.85
// 목록은 한 줄에 3장이라 칸이 130px 안팎 — 3배 밀도까지 감안해 400px
export const THUMB_MAX_EDGE = 400
export const THUMB_QUALITY = 0.75

export interface EncodedImage {
  blob: Blob
  width: number
  height: number
}

export interface ProcessedImage {
  full: EncodedImage
  thumb: EncodedImage
  /** 변환 전 원본 바이트 (절감량 표시용) */
  originalBytes: number
}

let webpSupport: boolean | null = null

/** WebP 인코딩이 안 되는 환경(구형 Safari)이면 JPEG로 저장한다. */
export function canEncodeWebp(): boolean {
  if (webpSupport !== null) return webpSupport
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  return webpSupport
}

const outputMime = () => (canEncodeWebp() ? 'image/webp' : 'image/jpeg')

function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  // EXIF 회전 정보를 반영해 디코드한다 (세로로 찍은 사진이 눕지 않게)
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return await createImageBitmap(file)
  }
}

type Source = ImageBitmap | HTMLCanvasElement

function shrink(source: Source, maxEdge: number): HTMLCanvasElement {
  const { width, height } = fitWithin(source.width, source.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 사용할 수 없습니다.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<EncodedImage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('이미지 변환에 실패했습니다.'))
        resolve({ blob, width: canvas.width, height: canvas.height })
      },
      outputMime(),
      quality,
    )
  })
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`이미지 파일이 아닙니다: ${file.name}`)
  }
  const bitmap = await loadBitmap(file)
  try {
    const shrunk = shrink(bitmap, FULL_MAX_EDGE)
    const full = await encode(shrunk, FULL_QUALITY)
    // 썸네일은 이미 줄인 캔버스에서 뽑는다 — 원본을 두 번 훑지 않아도 화질 차이가 없다
    const thumb = await encode(shrink(shrunk, THUMB_MAX_EDGE), THUMB_QUALITY)
    return { full, thumb, originalBytes: file.size }
  } finally {
    bitmap.close()
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
