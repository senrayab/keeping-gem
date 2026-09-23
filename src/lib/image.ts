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
/* 사진첩 사진은 여러 장 쌓이므로 조금 작게 — 휴대폰 화면에서는 차이를 느끼기 어렵다 */
export const PHOTO_MAX_EDGE = 1600
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
  /** 포스터의 대표색 "r g b" — 밤하늘에서 별이 이 색으로 빛난다 */
  color: string
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

export async function processImage(file: File, maxEdge = FULL_MAX_EDGE): Promise<ProcessedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`이미지 파일이 아닙니다: ${file.name}`)
  }
  const bitmap = await loadBitmap(file)
  try {
    const shrunk = shrink(bitmap, maxEdge)
    const full = await encode(shrunk, FULL_QUALITY)
    // 썸네일은 이미 줄인 캔버스에서 뽑는다 — 원본을 두 번 훑지 않아도 화질 차이가 없다
    const thumbCanvas = shrink(shrunk, THUMB_MAX_EDGE)
    const thumb = await encode(thumbCanvas, THUMB_QUALITY)
    return { full, thumb, originalBytes: file.size, color: glowColor(thumbCanvas) }
  } finally {
    bitmap.close()
  }
}

/**
 * 그림 전체의 평균색을 뽑아 빛나는 색으로 다듬는다.
 *
 * 평균색은 대개 탁한 회갈색이라 그대로 쓰면 별이 흐려 보인다.
 * 색상(hue)만 살리고 채도와 밝기를 끌어올려 '그 포스터다운 빛'으로 만든다.
 */
function glowColor(canvas: HTMLCanvasElement): string {
  const small = shrink(canvas, 24)
  const ctx = small.getContext('2d')
  if (!ctx) return '255 200 120'
  const { data } = ctx.getImageData(0, 0, small.width, small.height)
  let r = 0
  let g = 0
  let b = 0
  let weight = 0
  for (let i = 0; i < data.length; i += 4) {
    const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]]
    // 채도가 높은 픽셀에 무게를 더 준다 — 흰 여백이나 검은 배경에 색이 묻히지 않게
    const w = 1 + (Math.max(pr, pg, pb) - Math.min(pr, pg, pb)) / 32
    r += pr * w
    g += pg * w
    b += pb * w
    weight += w
  }
  const [h, s] = rgbToHsl(r / weight, g / weight, b / weight)
  const [or, og, ob] = hslToRgb(h, Math.max(s, 0.6), 0.62)
  return `${or} ${og} ${ob}`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    t = (t + 1) % 1
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p
    return Math.round(v * 255)
  }
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
