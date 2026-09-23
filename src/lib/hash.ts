/**
 * 그림의 지문.
 *
 * 같은 사진을 두 번 넣지 않으려고 쓴다. 파일 이름이나 찍은 때가 달라도
 * 내용이 같으면 같은 지문이 나온다. (https와 localhost에서만 쓸 수 있다)
 */
export async function fingerprint(blob: Blob): Promise<string | undefined> {
  if (!crypto?.subtle) return undefined
  try {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // 지문을 못 구해도 사진을 넣는 데는 지장이 없다 — 중복만 걸러내지 못한다
    return undefined
  }
}
