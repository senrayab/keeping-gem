import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type ChangeEvent } from 'react'
import { db } from '@/db/db'
import { useBackClose } from '@/hooks/useBackClose'
import { useScrollLock } from '@/hooks/useScrollLock'
import { applyBackup, createBackup, lastBackupAt, markBackedUp, readBackup, type RestorePreview } from '@/lib/backup'
import { download } from '@/lib/download'
import { formatBytes } from '@/lib/image'
import { useToast } from './Toast'

const formatWhen = (ms: number) =>
  new Date(ms).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** 보관함: 백업 파일 만들기와 백업에서 불러오기 */
export function BackupSheet({ onClose }: { onClose: () => void }) {
  useBackClose(onClose)
  useScrollLock()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'backup' | 'read' | 'restore' | null>(null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [lastBackup, setLastBackup] = useState(lastBackupAt)

  const stats = useLiveQuery(async () => {
    const [tickets, posters] = await Promise.all([db.tickets.toArray(), db.posters.toArray()])
    const bytes =
      tickets.reduce((sum, t) => sum + (t.thumb?.size ?? 0), 0) + posters.reduce((sum, p) => sum + p.blob.size, 0)
    const sinceBackup = lastBackup ? tickets.filter((t) => t.updatedAt > lastBackup).length : tickets.length
    return { count: tickets.length, bytes, sinceBackup }
  }, [lastBackup])

  const backup = async () => {
    setBusy('backup')
    try {
      const { blob, name, count } = await createBackup()
      download(blob, name)
      markBackedUp()
      setLastBackup(lastBackupAt())
      toast(`티켓 ${count}장을 백업했어요. 다운로드 폴더를 확인해 주세요.`)
    } catch (e) {
      console.error(e)
      toast('백업 파일을 만들지 못했어요.')
    } finally {
      setBusy(null)
    }
  }

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setBusy('read')
    try {
      setPreview(await readBackup(file))
    } catch (e) {
      toast(e instanceof Error ? e.message : '백업 파일을 읽지 못했어요.')
    } finally {
      setBusy(null)
    }
  }

  const restore = async () => {
    if (!preview) return
    setBusy('restore')
    try {
      await applyBackup(preview)
      toast(`티켓 ${preview.tickets.length}장을 불러왔어요.`)
      setPreview(null)
      onClose()
    } catch (e) {
      console.error(e)
      toast('불러오지 못했어요. 휴대폰 저장 공간을 확인해 주세요.')
      setBusy(null)
    }
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="보관함">
      <div className="sheet__body">
        <header className="sheet__head">
          <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
            닫기
          </button>
          <h2>보관함</h2>
          <span />
        </header>

        <section className="vault">
          <p className="vault__big">
            별 <strong>{stats?.count ?? 0}</strong>개
            <small>{stats && stats.bytes > 0 ? ` · 포스터 ${formatBytes(stats.bytes)}` : ''}</small>
          </p>
          <p className="vault__note">
            티켓과 포스터는 <strong>이 휴대폰 안에만</strong> 저장돼요. 휴대폰을 바꾸거나 브라우저 데이터를 지우면
            사라지니, 가끔 백업 파일을 만들어 드라이브나 PC에 옮겨 두세요.
          </p>
        </section>

        <section className="vault">
          <h3>백업 파일 만들기</h3>
          <p className="vault__meta">
            {lastBackup ? `마지막 백업 ${formatWhen(lastBackup)}` : '아직 백업한 적이 없어요.'}
            {stats && stats.sinceBackup > 0 && lastBackup && (
              <>
                <br />
                그 뒤로 새로 쓰거나 고친 티켓 {stats.sinceBackup}장
              </>
            )}
          </p>
          <button className="btn btn--glow" disabled={busy !== null || !stats?.count} onClick={() => void backup()}>
            {busy === 'backup' ? '만드는 중…' : '백업 파일 저장'}
          </button>
        </section>

        <section className="vault">
          <h3>백업에서 불러오기</h3>
          {!preview ? (
            <>
              <p className="vault__meta">
                백업 파일(.zip)을 고르면 티켓을 합쳐서 불러와요. 지금 있는 티켓은 지워지지 않아요.
              </p>
              <button className="btn btn--ghost" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
                {busy === 'read' ? '읽는 중…' : '백업 파일 고르기'}
              </button>
            </>
          ) : (
            <div className="vault__preview">
              <p>
                {preview.createdAt > 0 && `${formatWhen(preview.createdAt)}에 만든 백업 · `}
                티켓 <strong>{preview.tickets.length}</strong>장
                {preview.existing > 0 && (
                  <>
                    <br />이 중 {preview.existing}장은 이미 있어서 백업 내용으로 바뀌어요.
                  </>
                )}
              </p>
              <div className="vault__row">
                <button className="btn btn--ghost" disabled={busy !== null} onClick={() => setPreview(null)}>
                  취소
                </button>
                <button className="btn btn--glow" disabled={busy !== null} onClick={() => void restore()}>
                  {busy === 'restore' ? '불러오는 중…' : '불러오기'}
                </button>
              </div>
            </div>
          )}
          <input ref={inputRef} type="file" accept=".zip,application/zip" hidden onChange={pick} />
        </section>
      </div>
    </div>
  )
}
