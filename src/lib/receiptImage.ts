import type { Ticket } from '@/db/db'
import { drawCover, fitLine, font, loadFonts, spacing, toPng, wrap, type Ctx } from './canvas'
import { categoryOf } from './categories'
import { formatDate } from './format'
import { barcodeBars, ticketNumber } from './seed'

/*
 * 영수증 스킨의 티켓을 공유용 이미지로 그린다.
 *
 * 밤하늘 티켓(lib/ticketImage.ts)과 마찬가지로 화면을 찍지 않고 캔버스에 새로 그린다.
 * 배치는 상세보기(ReceiptView)를 따른다 — 클립에 물린 포스터가 종이 윗변에 걸치고,
 * 그 아래로 제목·한마디·장소·날짜·좌석이 인쇄된다.
 *
 * 다만 금액은 넣지 않는다. 밤하늘 티켓과 같은 약속이다 — 나눠 보는 것은 그날의 추억이지 값이 아니다.
 * 화면에서 숨긴 바코드는 여기서는 남긴다. 종이 한 장으로 떨어져 나오면 그쪽이 영수증답다.
 */

const W = 1080
const PAPER_X = 60
const PAPER_W = W - PAPER_X * 2
const PAD = 66
const INNER = PAPER_W - PAD * 2
const TOOTH = 36 // 뜯긴 톱니 한 칸

const DESK = '#e9e6e0'
const PAPER = '#f8f5ef'
const INK = '#23201c'
const SOFT = '#6f6a62'
const AMBER = '#e4742c'

const SERIF = "'Instrument Serif', 'Noto Serif KR', Georgia, serif"
const HAND = "'Nanum Pen Script', 'Segoe Script', cursive"
const TYPE = "'Courier Prime', ui-monospace, 'Roboto Mono', monospace"

/** 캔버스에 쓸 글꼴을 미리 받아 둔다 (못 받으면 기본 글꼴로 그려진다) */
const FACES = [
  `400 76px ${SERIF}`,
  `400 58px ${HAND}`,
  `400 30px ${TYPE}`,
  `700 42px ${TYPE}`,
]

/** 포스터를 종이에 물고 있는 클립 */
function paperclip(ctx: Ctx, x: number, y: number, w: number, angle: number) {
  const h = w * 2.6
  const silver = ctx.createLinearGradient(x, y, x + w, y + h)
  silver.addColorStop(0, '#fdfdfd')
  silver.addColorStop(0.35, '#b9bcc2')
  silver.addColorStop(0.6, '#f2f3f5')
  silver.addColorStop(1, '#8d9199')

  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(angle)
  ctx.translate(-w / 2, -h / 2)
  ctx.strokeStyle = silver
  ctx.lineWidth = w * 0.18
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(35,32,28,0.35)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 6
  // 바깥 고리
  ctx.beginPath()
  ctx.roundRect(w * 0.06, 0, w * 0.88, h, w * 0.44)
  ctx.stroke()
  // 안쪽 고리 (위가 열린 모양)
  ctx.shadowColor = 'transparent'
  ctx.beginPath()
  ctx.roundRect(w * 0.3, h * 0.12, w * 0.4, h * 0.74, w * 0.2)
  ctx.stroke()
  ctx.restore()
}

/** 위는 곧고 아래만 뜯긴 종이 한 장 */
function paperPath(ctx: Ctx, top: number, bottom: number) {
  ctx.beginPath()
  ctx.moveTo(PAPER_X, top)
  ctx.lineTo(PAPER_X + PAPER_W, top)
  ctx.lineTo(PAPER_X + PAPER_W, bottom)
  for (let x = PAPER_X + PAPER_W; x > PAPER_X; x -= TOOTH) {
    ctx.lineTo(x - TOOTH / 2, bottom + TOOTH * 0.6)
    ctx.lineTo(x - TOOTH, bottom)
  }
  ctx.closePath()
}

function dashedRule(ctx: Ctx, y: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(35,32,28,0.3)'
  ctx.lineWidth = 3
  ctx.setLineDash([14, 12])
  ctx.beginPath()
  ctx.moveTo(PAPER_X + PAD, y)
  ctx.lineTo(PAPER_X + PAPER_W - PAD, y)
  ctx.stroke()
  ctx.restore()
}

export async function renderReceiptImage(ticket: Ticket, poster?: Blob): Promise<Blob> {
  await loadFonts(FACES)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 사용할 수 없습니다.')

  const category = categoryOf(ticket.category)
  const bitmap = poster ? await createImageBitmap(poster).catch(() => undefined) : undefined

  // ── 1. 배치 계산 ──
  const photoW = 560
  const ratio = bitmap ? bitmap.width / bitmap.height : ticket.posterRatio ?? 3 / 4
  const photoH = Math.round(Math.min(Math.max(photoW / ratio, photoW * 0.9), photoW * 1.5))
  const frameW = photoW + 40 // 인화지 흰 테두리
  const frameH = photoH + 40 + 56 // 아래쪽은 더 넓게
  const frameX = PAPER_X + PAPER_W - frameW - 20
  const frameY = 80

  const paperTop = frameY + 130 // 포스터가 종이 윗변에 걸친다
  const left = PAPER_X + PAD
  let y = frameY + frameH + 90 // 첫 글줄의 기준선

  font(ctx, 400, 76, SERIF)
  const titleLines = wrap(ctx, ticket.title, INNER, 3)
  const titleY = y
  y += (titleLines.length - 1) * 84

  font(ctx, 400, 58, HAND)
  const memoLines = ticket.memo ? wrap(ctx, ticket.memo, INNER, 2) : []
  const memoY = memoLines.length ? y + 78 : y
  y = memoLines.length ? memoY + (memoLines.length - 1) * 64 : y

  const venueY = ticket.venue ? y + 62 : y
  y = venueY

  const ruleY = y + 54
  const gridY = ruleY + 64
  font(ctx, 700, 42, TYPE)
  const seatLines = wrap(ctx, ticket.seat || '—', INNER, 2)
  const seatY = gridY + 130
  const gridEnd = seatY + 56 + (seatLines.length - 1) * 56

  const barY = gridEnd + 90
  const paperBottom = barY + 190
  const H = Math.round(paperBottom + TOOTH + 70)

  canvas.width = W
  canvas.height = H

  // ── 2. 책상 바탕 ──
  ctx.fillStyle = DESK
  ctx.fillRect(0, 0, W, H)

  // ── 3. 종이 ──
  ctx.save()
  ctx.shadowColor = 'rgba(35,32,28,0.3)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 24
  paperPath(ctx, paperTop, paperBottom)
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.restore()

  // ── 4. 클립에 물린 포스터 ──
  ctx.save()
  ctx.translate(frameX + frameW / 2, frameY + frameH / 2)
  ctx.rotate((2.2 * Math.PI) / 180)
  ctx.translate(-frameW / 2, -frameH / 2)
  ctx.shadowColor = 'rgba(35,32,28,0.4)'
  ctx.shadowBlur = 46
  ctx.shadowOffsetY = 18
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, frameW, frameH)
  ctx.shadowColor = 'transparent'
  if (bitmap) {
    drawCover(ctx, bitmap, 20, 20, photoW, photoH)
    bitmap.close()
  } else {
    ctx.fillStyle = '#eeebe5'
    ctx.fillRect(20, 20, photoW, photoH)
    ctx.fillStyle = SOFT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    font(ctx, 400, 40, TYPE)
    ctx.fillText(category.label, 20 + photoW / 2, 20 + photoH / 2)
  }
  ctx.restore()

  paperclip(ctx, frameX + frameW * 0.62, frameY - 54, 62, (-7 * Math.PI) / 180)

  // ── 5. 종이 왼쪽에 세로로 찍히는 종류 (글자는 눕히지 않고 한 자씩 쌓는다) ──
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = SOFT
  font(ctx, 400, 30, TYPE)
  ;[...category.label].forEach((char, i) => ctx.fillText(char, PAPER_X + 58, paperTop + 70 + i * 42))
  ctx.restore()

  // ── 6. 제목·한마디·장소 ──
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  font(ctx, 400, 76, SERIF)
  titleLines.forEach((line, i) => ctx.fillText(line, left, titleY + i * 84))

  if (memoLines.length) {
    ctx.fillStyle = AMBER
    font(ctx, 400, 58, HAND)
    memoLines.forEach((line, i) => ctx.fillText(line, left, memoY + i * 64))
  }

  if (ticket.venue) {
    ctx.fillStyle = SOFT
    ctx.fillText(fitLine(ctx, ticket.venue, INNER, 400, 32, 24, TYPE), left, venueY)
  }

  dashedRule(ctx, ruleY)

  // ── 7. 날짜·시간·좌석 (금액은 넣지 않는다) ──
  const right = PAPER_X + PAPER_W - PAD
  const colW = INNER / 2 - 20

  const label = (text: string, x: number, at: number, align: CanvasTextAlign) => {
    ctx.textAlign = align
    ctx.fillStyle = SOFT
    font(ctx, 400, 26, TYPE)
    spacing(ctx, 5)
    ctx.fillText(text, x, at)
    spacing(ctx, 0)
    ctx.fillStyle = INK
  }

  label('DATE', left, gridY, 'left')
  ctx.fillText(fitLine(ctx, formatDate(ticket.date), colW, 700, 42, 28, TYPE), left, gridY + 58)
  label('TIME', right, gridY, 'right')
  ctx.fillText(fitLine(ctx, ticket.time ?? '—', colW, 700, 42, 28, TYPE), right, gridY + 58)

  label('SEAT', left, seatY, 'left')
  font(ctx, 700, 42, TYPE)
  ctx.textAlign = 'left'
  seatLines.forEach((line, i) => ctx.fillText(line, left, seatY + 58 + i * 56))

  // ── 8. 바코드와 일련번호 ──
  const barW = INNER * 0.7
  const barX = PAPER_X + (PAPER_W - barW) / 2
  const unit = barW / 200
  ctx.fillStyle = INK
  for (const bar of barcodeBars(ticket.id)) ctx.fillRect(barX + bar.x * unit, barY, bar.w * unit, 96)

  ctx.textAlign = 'center'
  ctx.fillStyle = SOFT
  font(ctx, 400, 26, TYPE)
  spacing(ctx, 6)
  ctx.fillText(ticketNumber(ticket.id, ticket.date), W / 2, barY + 150)
  spacing(ctx, 0)

  return toPng(canvas)
}
