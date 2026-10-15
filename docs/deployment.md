# 배포 가이드

`main` 머지 → 자동 배포 흐름, 도메인, 시크릿을 정리합니다. 복구·롤백·장애 대응 절차는 [`operations-runbook.md`](./operations-runbook.md)가 단일 원천입니다.

## 도메인

| 주소                                                                         | 역할                                                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [https://thetcn.org](https://thetcn.org)                                     | **운영 대표 주소(커스텀 도메인)**. `astro.config.mjs`의 `site`, canonical·`og:url`·sitemap의 기준                     |
| [https://tcn.faithinker12.workers.dev](https://tcn.faithinker12.workers.dev) | 같은 Worker의 `workers.dev` 기본 주소. 배포 후 smoke(`deploy-workers.yml`의 `PRODUCTION_URL`)가 아직 이 주소를 칩니다 |
| [https://tcn-ezj.pages.dev](https://tcn-ezj.pages.dev)                       | 구버전 Pages 정적 사이트(`/ko/`·`/en/`). 갱신되지 않으며 참고용                                                       |

도메인을 바꾸거나 더할 때 함께 맞출 곳입니다.

- `astro.config.mjs`의 `site` - canonical·`og:url`·`sitemap.xml`이 여기서 파생됩니다.
- `public/robots.txt`의 `Sitemap:` 줄 - 정적 파일이라 `site`에서 파생되지 않으므로 따로 고칩니다.
- `QNA_TURNSTILE_HOSTNAMES` 시크릿 - 공개 Q&A는 Turnstile 검증 응답의 hostname이 이 **정확 일치 허용 목록**에 있어야 통과하고, 없으면 질문 생성과 `/api/ready`가 fail closed(503)됩니다. 방문자가 접속하는 모든 호스트(`thetcn.org` 등)를 쉼표로 넣어야 하며, Turnstile 위젯 자체에도 같은 호스트가 허용돼 있어야 합니다.
- 배포 smoke 대상(`deploy-workers.yml`의 `PRODUCTION_URL`·`environment.url`) - 현재 `workers.dev`입니다. 커스텀 도메인으로 옮길지는 별도 결정입니다.

## 자동 배포

`main`에 머지되면 `deploy-workers.yml`이 전체 의존성 감사, check·test·build, D1 Time Travel bookmark와 migration 적용 후 Worker를 배포합니다. 배포 뒤 순서가 핵심입니다.

1. **버전 전파 대기** - `wrangler deploy`가 보고한 version id가 실제로 트래픽 100%를 받을 때까지 `wrangler deployments status`를 5초 간격 12회 폴링합니다. 그 안에 도달하지 못하거나 deploy 출력에 version id가 없으면 워크플로를 실패시킵니다.
2. **운영 smoke** - 그 다음에야 `/`, `/api/health`, `/api/ready`를 검사합니다.
3. **자동 rollback** - smoke가 실패하면 `wrangler rollback`으로 직전 버전으로 되돌립니다.

1번이 없으면 smoke가 이전 버전에 닿고도 초록이 됩니다. 이유와 사고 사례는 [`operations-runbook.md`](./operations-runbook.md)의 Release invariants를 보세요.

수동 배포는:

```bash
TCN_CONTENT_SOURCE=remote npm run build && npx wrangler deploy
```

`TCN_CONTENT_SOURCE=remote`를 빼면 빌드가 로컬 D1(`.wrangler/state`)의 세미나 목록으로 정적 페이지를 굽습니다. 테스트 데이터가 운영 홈에 나갈 수 있으니 수동 배포에서는 꼭 붙이세요. 실수로 나갔더라도 아래 자동 갱신이 10분 안에 바로잡습니다.

## 정적 공개 페이지와 자동 갱신

홈(`/`)·`/about`·`/seminars`는 빌드 때 구운 정적 에셋입니다. 정적 에셋 요청은 Worker 호출이 아니라 무료·무제한이라, Workers Free의 하루 10만 요청 한도를 방문자 수와 무관하게 쓰지 않습니다. 세미나 상세(`/seminars/<date>`)·`/media/*`·API는 삭제가 즉시 반영돼야 해서 계속 Worker가 처리합니다.

- **데이터**: `npm run build`(와 `dev`·`start`) 앞에서 `scripts/export-public-content.mjs`가 D1의 공개 세미나 목록을 `src/generated/public-seminars.json`(gitignore)으로 내보내고, 세 페이지가 이 스냅샷으로 프리렌더됩니다. 출처는 환경에 따라 자동 선택됩니다.
  - 운영 배포(`deploy-workers.yml`): `TCN_REQUIRE_CONTENT=1` - 운영 D1만 허용하고, 읽지 못하면 **빌드가 실패**합니다(빈 목록이나 로컬 데이터로 배포되지 않도록).
  - `CLOUDFLARE_API_TOKEN`이 있으면 운영 D1, 없고 로컬 D1이 있으면 로컬, 둘 다 없으면 빈 스냅샷(CI의 PR 빌드). `TCN_CONTENT_SOURCE=remote|local|empty`로 직접 고를 수 있습니다.
- **자동 갱신**: `refresh-static-content.yml`이 10분마다 라이브 지문(`/api/content-fingerprint`, D1 기준)과 배포본 지문(`/content-fingerprint.json`, 정적)을 비교합니다. 지문은 세미나 목록 + KST 날짜의 해시라서, 세미나를 추가·수정·삭제했거나 날짜가 넘어가 상태(예정/오늘/지난)가 바뀌면 달라집니다. 달라지면 `deploy-workers.yml`을 `workflow_dispatch`로 다시 돌립니다.
  - 반영 지연은 최대 약 10분 + 배포 시간(약 5분)입니다. 본문·사진 변경은 상세 페이지가 즉시 반영하므로 이 지연과 무관합니다.
  - 비교 자체가 실패하면(엔드포인트 장애, 챌린지 HTML 등) 배포하지 않고 워크플로를 실패로 표시합니다. 배포가 진행 중이면 건너뛰고, 직전 15분 안에 이 경로로 배포했는데도 어긋나면 루프 방지로 다시 배포하지 않습니다.
  - `PRODUCTION_URL`은 배포 smoke와 같은 `workers.dev`입니다. `workers.dev`를 끄면 두 워크플로를 함께 옮겨야 하고, 존 도메인으로 옮길 때는 Bot Fight Mode가 러너 IP의 비브라우저 요청을 챌린지할 수 있어 깨질 수 있습니다.
  - 저장소에 60일간 활동이 없으면 GitHub이 예약 워크플로를 멈춥니다. 멈추면 정적 페이지가 낡습니다.
- **수동 갱신**: Actions 탭에서 `Deploy Cloudflare Workers`를 `main`에서 실행하면 즉시 다시 굽습니다.

## 시크릿

원격 시크릿은 개별 설정이면 `wrangler secret put <이름>`, 여러 건을 한 번에 맞출 때는 gitignore된 `.dev.vars.production`을 만들어 `npx wrangler secret bulk .dev.vars.production`으로 넣습니다(운영은 이 경로를 씁니다). `.gitignore`가 `.dev.vars`와 `.dev.vars.*`를 모두 제외하므로 커밋에 섞이지 않습니다.

| 시크릿                           | 용도                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| `SESSION_SECRET`                 | 세션 쿠키 서명 (직접 생성: `openssl rand -hex 32`)              |
| `TURNSTILE_SITE_KEY`             | Q&A 작성 폼의 공개 Turnstile site key                           |
| `TURNSTILE_SECRET_KEY`           | Q&A Siteverify Worker secret                                    |
| `QNA_TURNSTILE_HOSTNAMES`        | Siteverify exact hostname allowlist (쉼표 구분, 위 도메인 참고) |
| `QNA_RATE_LIMIT_SECRET`          | 원 IP 비저장 HMAC rate-limit key                                |
| `DISCORD_WEBHOOK`                | 글 알림 - 디스코드 웹훅 URL                                     |
| `TELEGRAM_TOKEN` · `TELEGRAM_TO` | 글 알림 - 봇 토큰 · 채팅 ID                                     |

- 로컬은 `.dev.vars`를 사용하며 커밋에서 제외합니다(키 목록은 `.env.example`). 로컬 Q&A 제출 검증에는 localhost를 허용한 전용 Turnstile widget과 `QNA_TURNSTILE_HOSTNAMES=localhost`를 씁니다. Turnstile 공식 dummy key 응답에는 hostname이 없어 단위·CI 테스트는 Siteverify를 mock합니다.
- 관리자 로그인도 같은 Turnstile 위젯·키를 씁니다(`data-action="admin_login"`이라 Q&A 토큰으로는 통과하지 못합니다). 그래서 **로그인이 되려면 `thetcn.org`가 위젯의 Hostnames와 `QNA_TURNSTILE_HOSTNAMES`에 모두 있어야** 하고, 둘 중 하나가 빠지면 로그인 화면이 위젯을 못 띄우거나 서버가 403으로 닫습니다. `LOGIN_CHALLENGE=off`는 로컬·CI의 `.dev.vars` 전용 스위치로, 요청이 `localhost`일 때만 챌린지를 건너뜁니다(운영에는 설정하지 않으며 설정돼도 운영 호스트에선 무효).
- Q&A 4종이 하나라도 없거나 검증이 실패하면 질문 생성과 readiness는 fail closed됩니다. 알림 시크릿이 없으면 해당 채널만 건너뛰고 글 저장·공개에는 영향이 없습니다.
- `PUBLIC_MEMBERSHIP_FORM_URL`은 시크릿이 아니라 공개 환경변수입니다(`.env.example`). 비어 두면 `/contact`의 가입 링크 자리에 "Application form coming soon" 비활성 표시가 노출됩니다.
