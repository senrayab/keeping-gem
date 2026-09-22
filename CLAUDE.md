# keeping-gem

모바일 전용 PWA. 서버 없이 정적 파일(HTML/CSS/JS)만으로 동작하고, GitHub Pages로 배포한다.
사용자는 휴대폰에서 배포 URL을 열고 홈 화면에 설치해서 확인한다.

## 프로젝트 구조

- `index.html`, `style.css`, `app.js` — 앱 본체 (빌드 단계 없음)
- `manifest.webmanifest` — PWA 설치 정보
- `sw.js` — 서비스 워커 (네트워크 우선, 오프라인 시 캐시 사용)
- `icons/` — 앱 아이콘
- `.github/workflows/deploy.yml` — `main`에 푸시되면 GitHub Pages에 배포

## 개발 원칙

- 모바일 화면(폭 360~430px)을 기준으로 만든다. 데스크톱 레이아웃은 신경 쓰지 않는다.
- 터치 영역은 최소 44px, `env(safe-area-inset-*)`로 노치/홈 바 영역을 피한다.
- 새 파일을 추가해 오프라인에서도 필요하면 `sw.js`의 `PRECACHE` 목록에 넣는다.
- 파일 경로는 항상 상대 경로(`./...`)로 쓴다. Pages는 `/keeping-gem/` 하위 경로에서 서비스된다.

## 작업 완료 후 자동 배포 절차

사용자가 요청한 작업을 끝내면 **따로 묻지 않고** 아래 절차를 끝까지 진행한다.

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
