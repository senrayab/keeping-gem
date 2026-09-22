import { useRef, useState, type ChangeEvent } from 'react'
import { addPhoto } from '@/db/db'
import { formatBytes, processImage } from '@/lib/image'
import { useToast } from './Toast'

/**
 * 사진을 찍거나 앨범에서 골라 WebP로 바꿔 저장한다.
 *
 * 촬영은 폰 기본 카메라를 부른다(capture). 앱 안에서 카메라를 켜는 것보다
 * 원본 화질을 그대로 받고, 초점·플래시 같은 기본 카메라 기능을 다 쓸 수 있다.
 */
export function AddPhotoBar() {
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const toast = useToast()

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])
    // 같은 사진을 다시 골라도 change가 오도록 비워둔다
    input.value = ''
    if (!files.length) return

    let before = 0
    let after = 0
    let failed = 0
    setBusy({ done: 0, total: files.length })
    // 한 장씩 처리한다 — 한꺼번에 디코드하면 폰 메모리가 모자랄 수 있다
    for (const [i, file] of files.entries()) {
      try {
        const processed = await processImage(file)
        await addPhoto(processed)
        before += processed.originalBytes
        after += processed.full.blob.size + processed.thumb.blob.size
      } catch (e) {
        console.error(e)
        failed += 1
      }
      setBusy({ done: i + 1, total: files.length })
    }
    setBusy(null)

    const saved = files.length - failed
    if (saved > 0) {
      toast(`${saved}장 저장 · ${formatBytes(before)} → ${formatBytes(after)}${failed ? ` (${failed}장 실패)` : ''}`)
    } else {
      toast('사진을 저장하지 못했어요.')
    }
  }

  return (
    <div className="add-bar">
      <button className="btn btn--primary" disabled={busy !== null} onClick={() => cameraRef.current?.click()}>
        촬영하기
      </button>
      <button className="btn" disabled={busy !== null} onClick={() => albumRef.current?.click()}>
        {busy ? `변환 중 ${busy.done}/${busy.total}` : '앨범에서 선택'}
      </button>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
    </div>
  )
}
