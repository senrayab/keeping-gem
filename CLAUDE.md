# keeping-gem

모바일 전용 PWA. 서버 없이 기기 안에서만 동작하고, GitHub Pages로 배포한다.
사용자는 휴대폰에서 배포 URL을 열고 홈 화면에 설치해서 확인한다.
구성은 senrayab/poca-archive와 같다: Vite + React + TypeScript + vite-plugin-pwa.

## 앱 개요: 추억의 밤하늘

공연·콘서트·전시 등의 티켓을 보관하는 앱. 티켓 한 장이 밤하늘의 별 하나다.

- 홈(`Sky.tsx`): 연도별 하늘이 위(최근)→아래(과거)로 이어지고, 별은 포스터를 품은 빛나는 구슬.
  같은 해의 별은 날짜 순으로 점선(별자리)으로 이어진다. 오른쪽 연도 줄로 해를 건너뛴다.
  **달력 화면은 쓰지 않는다** — 지난 추억을 찾기 어려워진다는 이유로 사용자가 원치 않음.
- 별을 누르면 그 자리에서 티켓이 펼쳐진다(`TicketDetail.tsx`, `TicketView.tsx`):
  포스터 + 제목·장소 + 절취선 + 날짜·시간·좌석·금액·한마디 + 홀로그램 반권(바코드).
- 별똥별 버튼: 무작위 추억 하나를 펼친다. `+` 버튼: 티켓 추가(`TicketForm.tsx`).
- 디자인 톤: 어두운 밤하늘 + 따뜻한 빛번짐(보케), 유리구슬 질감, 종이 티켓 + 홀로그램.

## 프로젝트 구조

- `src/main.tsx`, `src/App.tsx` — 앱 진입점, 화면 상태(열린 티켓·입력 시트)
- `src/components/` — 화면 조각 (`UpdateToast.tsx`: 새 배포 새로고침 안내, `Toast.tsx`: 짧은 안내)
- `src/db/db.ts` — IndexedDB(Dexie). `tickets`(목록용, 썸네일 포함) / `posters`(포스터 원본) 분리.
  사진은 서버로 보내지 않고 기기 안에만 저장한다. 스키마를 바꾸면 `version()`을 올린다.
- `src/lib/image.ts` — 포스터 → WebP 변환(긴 변 2000px), 대표색(별 빛깔) 추출
- `src/lib/seed.ts` — 티켓 id 기반 고정 난수(별 자리·크기·바코드가 늘 같게)
- `src/hooks/useBackClose.ts` — 뒤로 가기로 겹친 화면 닫기. 새 오버레이는 반드시 이 훅을 쓴다
- `src/styles/global.css` — 전역 스타일(밤하늘 테마 토큰은 `:root`)
- `public/` — 그대로 복사되는 파일 (아이콘)
- `vite.config.ts` — 빌드·PWA(manifest, 서비스 워커) 설정
- `.github/workflows/deploy.yml` — `main`에 푸시되면 빌드 후 GitHub Pages에 배포

## 명령

- `npm run dev` — 개발 서버 (같은 Wi-Fi의 휴대폰에서 `http://<PC IP>:5173` 접속 가능)
- `npm run build` — 타입 검사 + 빌드 (`dist/`)
- `npm run preview` — 빌드 결과를 `/keeping-gem/` 경로로 띄워 확인
- `npm run typecheck` — 타입 검사만

## 개발 원칙

- TypeScript `strict` 모드. `any`, `@ts-ignore`로 타입 오류를 덮지 않는다.
- 모바일 화면(폭 360~430px)을 기준으로 만든다. 데스크톱 레이아웃은 신경 쓰지 않는다.
- 터치 영역은 최소 44px, `env(safe-area-inset-*)`로 노치/홈 바 영역을 피한다.
- 앱은 `/keeping-gem/` 하위 경로에서 서비스된다. 경로는 `import.meta.env.BASE_URL` 기준으로 만든다.

## 작업 완료 후 자동 배포 절차

사용자가 요청한 작업을 끝내면 **따로 묻지 않고** 아래 절차를 끝까지 진행한다.

### 0. 빌드 확인

커밋 전에 `npm run build`가 통과해야 한다. 실패하면 고친 뒤 진행한다.

### 1. 변경사항 묶기

`git status`와 `git diff`로 변경 내용을 보고 주제별로 묶는다.

- 같은 기능·같은 목적의 수정(예: 한 화면의 UI와 그 화면의 로직)은 **하나의 묶음**
- 목적이 다른 수정(예: 새 기능 + 관련 없는 버그 수정, 기능 + 문서/설정)은 **별도 묶음**
- 판단이 애매하면 "이 변경을 따로 되돌릴 일이 있을까?"를 기준으로 삼는다. 그렇다면 분리한다.

### 2. 묶음마다 브랜치 → 커밋 → PR → 머지

묶음 하나씩 순서대로 처리한다. 커밋하지 않은 나머지 변경은 작업 트리에 그대로 둔 채 진행한다.

```sh
git checkout main && git pull --ff-only
git checkout -b <type>/<짧은-설명>          # 예: feat/gem-list, fix/install-banner
git add <이 묶음의 파일들>                    # git add -A 금지, 묶음 파일만
git commit -m "<type>: <한국어 요약>"
git push -u origin HEAD
gh pr create --base main --title "<type>: <한국어 요약>" --body "<아래 형식>"
gh pr merge --squash --delete-branch
git checkout main && git pull --ff-only
```

- `type`: `feat`(기능), `fix`(버그), `style`(UI/스타일), `refactor`, `docs`, `chore`(설정·빌드)
- 커밋 메시지·PR 제목·본문은 한국어로 쓴다.
- PR 본문 형식:

  ```
  ## 변경 내용
  - 무엇을 바꿨는지 (사용자 관점)

  ## 변경 이유
  - 왜 필요한지

  ## 확인 방법
  - 휴대폰에서 어디를 눌러 무엇을 보면 되는지
  ```

### 3. 배포 확인

마지막 머지 후 배포 워크플로가 끝날 때까지 확인한다.

```sh
gh run list --workflow deploy.yml --limit 1
gh run watch <run-id> --exit-status
```

- 성공하면 배포 URL(`https://senrayab.github.io/keeping-gem/`)과 만든 PR 목록을 알려준다.
- 실패하면 `gh run view <run-id> --log-failed`로 원인을 확인하고 고친 뒤 같은 절차로 다시 배포한다.
- 사용자에게는 "휴대폰에서 새로고침(또는 앱 재실행)하면 반영된다"고 안내한다.

### 예외

- 사용자가 "커밋하지 마", "배포는 나중에"처럼 말하면 그 지시를 따른다.
- 비밀값(토큰, 키)이 변경에 섞여 있으면 커밋하지 말고 사용자에게 알린다.
- `main`에 직접 커밋하거나 강제 푸시(`--force`)하지 않는다.
