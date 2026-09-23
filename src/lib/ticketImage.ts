import type { Ticket } from '@/db/db'
import { categoryOf } from './categories'
import { formatDate } from './format'
// barcodeBars·ticketNumber는 아래 주석 처리된 바코드 조각이 쓴다
import { seeded } from './seed'

/*
 * 상세보기의 티켓을 공유용 이미지로 그린다.
 *
 * 화면을 그대로 찍지(html → 이미지) 않고 캔버스에 새로 그린다. 절취선 홈(mask),
 * 흐림, 홀로그램 같은 효과는 화면 찍기 도구가 제대로 옮기지 못하고 기기마다
 * 결과가 달라진다. 직접 그리면 어느 폰에서든 같은 그림이 나온다.
 * 배치는 화면의 티켓(TicketView)과 같은 순서·비율을 따른다.
 */

const W = 1080
const TICKET_X = 90
const TICKET_W = W - TICKET_X * 2
const PAD = 60 // 티켓 안쪽 여백
const NOTCH = 36
const RADIUS = 56

const SANS = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif"
const MONO = "ui-monospace, 'SF Mono', 'Roboto Mono', 'Noto Sans Mono', monospace"

const PAPER = '#fbfaf7'
const INK = '#1b1826'
const SOFT = '#8a8598'

type Ctx = CanvasRenderingContext2D

/** "r g b" + 투명도 → 캔버스가 어느 기기에서든 읽는 rgba(r,g,b,a) */
const rgba = (rgb: string, alpha = 1) => `rgba(${rgb.split(' ').join(',')},${alpha})`

function font(ctx: Ctx, weight: number, size: number, family = SANS) {
  ctx.font = `${weight} ${size}px ${family}`
}

function spacing(ctx: Ctx, px: number) {
  // 글자 간격은 크롬 99+/사파리 17+에서만 된다. 없으면 붙여 쓴다.
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`
}

/** 폭에 맞춰 줄을 나눈다. 한글은 글자 단위, 나머지는 단어 단위로 끊는다. */
function wrap(ctx: Ctx, text: string, width: number, maxLines: number): string[] {
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
function fitLine(ctx: Ctx, text: string, width: number, weight: number, size: number, min: number): string {
  let s = size
  font(ctx, weight, s)
  while (s > min && ctx.measureText(text).width > width) font(ctx, weight, --s)
  return wrap(ctx, text, width, 1)[0]
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** 모서리는 둥글고, 절취선 자리 양옆에 반원 홈이 파인 티켓 외곽선 */
function ticketPath(ctx: Ctx, top: number, bottom: number, perfs: number[]) {
  const x = TICKET_X
  const w = TICKET_W
  const R = RADIUS
  ctx.beginPath()
  ctx.moveTo(x + R, top)
  ctx.lineTo(x + w - R, top)
  ctx.arcTo(x + w, top, x + w, top + R, R)
  for (const y of perfs) {
    ctx.lineTo(x + w, y - NOTCH)
    ctx.arc(x + w, y, NOTCH, -Math.PI / 2, Math.PI / 2, true)
  }
  ctx.lineTo(x + w, bottom - R)
  ctx.arcTo(x + w, bottom, x + w - R, bottom, R)
  ctx.lineTo(x + R, bottom)
  ctx.arcTo(x, bottom, x, bottom - R, R)
  for (const y of [...perfs].reverse()) {
    ctx.lineTo(x, y + NOTCH)
    ctx.arc(x, y, NOTCH, Math.PI / 2, -Math.PI / 2, true)
  }
  ctx.lineTo(x, top + R)
  ctx.arcTo(x, top, x + R, top, R)
  ctx.closePath()
}

function perforation(ctx: Ctx, y: number) {
  ctx.save()
  ctx.strokeStyle = '#dedbe6'
  ctx.lineWidth = 5
  ctx.setLineDash([16, 12])
  ctx.beginPath()
  ctx.moveTo(TICKET_X + NOTCH + 24, y)
  ctx.lineTo(TICKET_X + TICKET_W - NOTCH - 24, y)
  ctx.stroke()
  ctx.restore()
}

function drawCover(ctx: Ctx, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/**
 * 포스터 왼쪽 아래를 종류 라벨 크기만큼 파낸다.
 *
 * 파낸 자리는 티켓 종이 색으로 채우고, 포스터와 만나는 두 지점은 원호로 오목하게 이어
 * 직각이 남지 않게 한다. 화면(TicketView)의 라벨과 같은 모양이다.
 */
function chipNotch(ctx: Ctx, x: number, y: number, w: number, h: number, label: string) {
  font(ctx, 700, 30)
  const W = ctx.measureText(label).width + 56
  const H = 86
  const R = 30 // 파낸 자리 안쪽 모서리(볼록)
  const r = 22 // 포스터와 만나는 곳(오목)
  const bottom = y + h

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x, bottom - H - r)
  ctx.arc(x + r, bottom - H - r, r, Math.PI, Math.PI / 2, true)
  ctx.lineTo(x + W - R, bottom - H)
  ctx.arcTo(x + W, bottom - H, x + W, bottom - H + R, R)
  ctx.lineTo(x + W, bottom - r)
  ctx.arc(x + W + r, bottom - r, r, Math.PI, Math.PI / 2, true)
  ctx.lineTo(x, bottom)
  ctx.closePath()
  ctx.fillStyle = PAPER
  ctx.fill()

  ctx.fillStyle = '#4a3f63'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + W / 2, bottom - H / 2)
  ctx.restore()
  // w는 포스터 폭 — 파낸 자리가 포스터를 넘지 않는지 확인용
  if (W + r > w) console.warn('종류 라벨이 포스터보다 넓습니다')
}

export async function renderTicketImage(ticket: Ticket, poster?: Blob): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 사용할 수 없습니다.')

  const category = categoryOf(ticket.category)
  const glow = ticket.glow ?? category.glow
  const bitmap = poster ? await createImageBitmap(poster).catch(() => undefined) : undefined
  const inner = TICKET_W - PAD * 2

  // ── 1. 배치 계산 (캔버스 크기를 정해야 그릴 수 있으므로 먼저 잰다) ──
  const top = 120
  const posterX = TICKET_X + 30
  const posterW = TICKET_W - 60
  const ratio = bitmap ? bitmap.width / bitmap.height : ticket.posterRatio ?? 3 / 4
  const posterH = Math.round(Math.min(Math.max(posterW / ratio, posterW * 0.6), posterW * 1.5))
  const posterY = top + 30

  font(ctx, 800, 60)
  const titleLines = wrap(ctx, ticket.title, inner, 3)
  // 세로 위치는 모두 글자의 기준선(baseline)이다. 종류 라벨은 포스터 위에 얹으므로 자리를 차지하지 않는다.
  const titleY = posterY + posterH + 96
  const titleEnd = titleY + (titleLines.length - 1) * 76
  const venueY = titleEnd + 62
  const perf1 = (ticket.venue ? venueY : titleEnd) + 64

  const gridY = perf1 + 70
  const gridRowH = 130
  const gridEnd = gridY + gridRowH * Math.ceil(3 / 2) - 20

  font(ctx, 500, 34)
  const memoLines = ticket.memo ? wrap(ctx, ticket.memo, inner - 72, 6) : []
  const memoY = gridEnd + 10
  const memoH = memoLines.length ? memoLines.length * 54 + 64 : 0
  const bottom = memoLines.length ? memoY + memoH + 40 : gridEnd + 40

  /*
   * 바코드는 읽히는 정보가 없는 장식이라 넣지 않는다 (아래 8번 참고).
   * 되살리려면 여기 stubGap·stubH를 되돌리고 8번의 주석을 푼다.
   */
  const stubY = bottom
  const H = stubY + 140

  canvas.width = W
  canvas.height = H

  // ── 2. 밤하늘 배경 ──
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#1d1538')
  sky.addColorStop(0.45, '#110d22')
  sky.addColorStop(1, '#07060d')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  const halo = ctx.createRadialGradient(W / 2, top + posterH * 0.6, 0, W / 2, top + posterH * 0.6, W * 0.9)
  halo.addColorStop(0, rgba(glow, 0.35))
  halo.addColorStop(1, rgba(glow, 0))
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, H)

  const rand = seeded(`${ticket.id}:sky`)
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = rgba('255 255 255', 0.15 + rand() * 0.6)
    ctx.beginPath()
    ctx.arc(rand() * W, rand() * H, 1 + rand() * 2.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── 3. 티켓 종이 ──
  ctx.save()
  ctx.shadowColor = rgba(glow, 0.5)
  ctx.shadowBlur = 90
  ticketPath(ctx, top, bottom, [perf1])
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.restore()

  // ── 4. 포스터 ──
  ctx.save()
  roundRect(ctx, posterX, posterY, posterW, posterH, 40)
  ctx.clip()
  if (bitmap) {
    drawCover(ctx, bitmap, posterX, posterY, posterW, posterH)
    bitmap.close()
  } else {
    const fill = ctx.createLinearGradient(posterX, posterY, posterX + posterW, posterY + posterH)
    fill.addColorStop(0, rgba(glow))
    fill.addColorStop(1, rgba(glow, 0.45))
    ctx.fillStyle = PAPER
    ctx.fillRect(posterX, posterY, posterW, posterH)
    ctx.fillStyle = fill
    ctx.fillRect(posterX, posterY, posterW, posterH)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    font(ctx, 900, 76)
    const lines = wrap(ctx, ticket.title, posterW - 120, 3)
    lines.forEach((line, i) => ctx.fillText(line, W / 2, posterY + posterH / 2 + (i - (lines.length - 1) / 2) * 92))
  }
  ctx.restore()

  chipNotch(ctx, posterX, posterY, posterW, posterH, category.label)

  // ── 5. 제목·장소 ──
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  font(ctx, 800, 60)
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, titleY + i * 76))

  if (ticket.venue) {
    ctx.fillStyle = SOFT
    ctx.fillText(fitLine(ctx, ticket.venue, inner, 600, 36, 26), W / 2, venueY)
  }

  perforation(ctx, perf1)

  /*
   * ── 6. 날짜·시간·좌석 ──
   * 금액은 넣지 않는다 — 나눠 보는 것은 그날의 추억이지 값이 아니다.
   * 금액은 앱 안 상세보기에서만 본다.
   */
  const cells: [string, string][] = [
    ['DATE', formatDate(ticket.date)],
    ['TIME', ticket.time ?? '—'],
    ['SEAT', ticket.seat || '—'],
  ]
  const colW = inner / 2 - 12
  cells.forEach(([label, value], i) => {
    const right = i % 2 === 1
    const x = right ? TICKET_X + TICKET_W - PAD : TICKET_X + PAD
    const y = gridY + Math.floor(i / 2) * gridRowH
    ctx.textAlign = right ? 'right' : 'left'
    ctx.fillStyle = SOFT
    font(ctx, 500, 26, MONO)
    spacing(ctx, 4)
    ctx.fillText(label, x, y)
    spacing(ctx, 0)
    ctx.fillStyle = INK
    const text = fitLine(ctx, value, colW, 700, 42, 28)
    ctx.fillText(text, x, y + 56)
  })

  // ── 7. 그날의 한마디 ──
  if (memoLines.length) {
    ctx.fillStyle = '#f1eff5'
    roundRect(ctx, TICKET_X + PAD, memoY, inner, memoH, 32)
    ctx.fill()
    ctx.fillStyle = '#4a4658'
    ctx.textAlign = 'left'
    font(ctx, 500, 34)
    memoLines.forEach((line, i) => ctx.fillText(line, TICKET_X + PAD + 36, memoY + 32 + 38 + i * 54))
  }

  /*
   * 티켓에서 떼어 낸 바코드 조각 — 지금은 넣지 않는다.
   * 뜻 없는 장식이라 뺐고, 되살리려면 아래 주석을 풀고 위 stubY/H 계산을 되돌린다.
   */
//   // ── 8. 티켓에서 떼어 낸 바코드 조각 ──
//   ctx.save()
//   ctx.shadowColor = rgba('0 0 0', 0.45)
//   ctx.shadowBlur = 40
//   ctx.shadowOffsetY = 12
//   roundRect(ctx, TICKET_X, stubY, TICKET_W, stubH, 28)
//   ctx.fillStyle = '#ffffff'
//   ctx.fill()
//   ctx.restore()
//
//   const barX = TICKET_X + PAD
//   const barY = stubY + 44
//   const unit = inner / 200
//   ctx.fillStyle = INK
//   for (const bar of barcodeBars(ticket.id)) ctx.fillRect(barX + bar.x * unit, barY, bar.w * unit, 96)
//
//   font(ctx, 500, 26, MONO)
//   spacing(ctx, 3)
//   ctx.fillStyle = '#4a4658'
//   ctx.textAlign = 'left'
//   // 'ADMIT ONE'은 뜻 없는 문구라 넣지 않는다. 일련번호만 바코드 아래에 남긴다.
//   ctx.fillText(ticketNumber(ticket.id, ticket.date), barX, barY + 142)

  // ── 9. 서명 ──
  ctx.textAlign = 'center'
  ctx.fillStyle = rgba('255 196 110', 0.85)
  font(ctx, 700, 26)
  spacing(ctx, 8)
  ctx.fillText('KEEPING GEM', W / 2, stubY + 84)
  spacing(ctx, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다.'))), 'image/png')
  })
}

/** 파일 이름에 못 쓰는 글자를 걷어낸다 */
export function ticketFileName(ticket: Ticket): string {
  const title = ticket.title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40) || 'ticket'
  return `${ticket.date}_${title}.png`
}
