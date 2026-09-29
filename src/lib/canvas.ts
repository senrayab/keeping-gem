/*
 * 캔버스에 글씨와 그림을 앉히는 공용 조각.
 *
 * 저장·공유 이미지는 화면을 찍지 않고 캔버스에 새로 그린다(lib/ticketImage.ts, lib/receiptImage.ts).
 * 스킨마다 그림은 달라도 글자를 재고 줄을 나누는 방식은 같아서 여기 모아 둔다.
 */
export type Ctx = CanvasRenderingContext2D

/*
 * 이모지는 화면과 같은 글꼴(토스페이스)로 그린다.
 * 화면에 이모지가 한 번이라도 그려졌다면 글꼴이 이미 받아져 있어 캔버스도 같은 모양을 쓴다.
 */
export const SANS =
  "'Tossface', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif"
export const MONO = "'Tossface', ui-monospace, 'SF Mono', 'Roboto Mono', 'Noto Sans Mono', monospace"

/** "r g b" + 투명도 → 캔버스가 어느 기기에서든 읽는 rgba(r,g,b,a) */
export const rgba = (rgb: string, alpha = 1) => `rgba(${rgb.split(' ').join(',')},${alpha})`

export function font(ctx: Ctx, weight: number, size: number, family = SANS) {
  ctx.font = `${weight} ${size}px ${family}`
}

export function spacing(ctx: Ctx, px: number) {
  // 글자 간격은 크롬 99+/사파리 17+에서만 된다. 없으면 붙여 쓴다.
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`
}

/** 폭에 맞춰 줄을 나눈다. 한글은 글자 단위, 나머지는 단어 단위로 끊는다. */
export function wrap(ctx: Ctx, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const token of paragraph.match(/[가-힣]|\S+|\s+/g) ?? []) {
      const next = line + token
      if (ctx.measureText(next).width > width && line.trim()) {
        lines.push(line.trimEnd())
        line = token.trimStart()
      } else {
        line = next
      }
    }
    lines.push(line.trimEnd())
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last}…`
    return kept
  }
  return lines
}

/** 한 줄에 들어가도록 글자 크기를 줄인다. 그래도 넘치면 말줄임. */
export function fitLine(
  ctx: Ctx,
  text: string,
  width: number,
  weight: number,
  size: number,
  min: number,
  family = SANS,
): string {
  let s = size
  font(ctx, weight, s, family)
  while (s > min && ctx.measureText(text).width > width) font(ctx, weight, --s, family)
  return wrap(ctx, text, width, 1)[0]
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** 칸을 가득 채우도록 가운데를 잘라 그린다 (CSS object-fit: cover와 같다) */
export function drawCover(ctx: Ctx, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/** 캔버스에 쓰기 전에 글꼴을 받아 둔다. 못 받으면 기본 글꼴로 그려진다. */
export async function loadFonts(faces: string[]) {
  if (!document.fonts) return
  await Promise.all(faces.map((face) => document.fonts.load(face, '가나다 ABC 123').catch(() => [])))
}

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다.'))), 'image/png')
  })
}
