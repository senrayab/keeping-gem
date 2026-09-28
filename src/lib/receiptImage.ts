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
/*
 * 종이 폭은 포스터 폭에 맞춘다.
 * 상세보기에서 포스터가 종이의 4분의 3쯤을 차지하는데, 종이만 넓히면 그 비율이 깨져
 * 같은 티켓인데도 이미지 쪽이 펑퍼짐해 보인다.
 */
const PAPER_X = 130
const PAPER_W = W - PAPER_X * 2
const PAD = 58
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
  // 바코드 아래로도 종이가 넉넉히 남는다 — 위쪽(포스터가 걸친 자리)과 무게를 맞춘다
  const paperBottom = barY + 260
  const H = Math.round(paperBottom + TOOTH + 100)

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

  /*
   * 클립은 그리지 않는다.
   * 화면에서는 뒤 화면이 비쳐 쇠붙이로 보이지만, 그림 위에서는 흰 아이콘 한 조각처럼 남는다.
   * 비스듬히 얹힌 인화지만으로도 '꽂아 둔 것'은 충분히 전해진다.
   */

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
