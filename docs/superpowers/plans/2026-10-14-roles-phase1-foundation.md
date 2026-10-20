# 게시판·역할 체계 1단계 구현 계획: 역할·상태 기반과 권한 가드 교체

> 이 문서는 Phase 1 구현 당시의 계획과 코드 예시를 보존한다. 이후 요구사항·작업 순서·검증과 배포 방침은 [통합 Phase 2 계획](2026-10-20-forum-and-user-management.md)을 따른다. 과거 체크박스를 근거로 이미 구현된 코드를 다시 작성하지 않는다.

**Goal:** 계정에 역할(`role`), 상태(`status`), 결정권(`is_executive`)을 도입하고, 임원 전용 기능의 권한 검사를 "세션이 있으면 통과"에서 "승인된 임원만 통과"로 교체한다. 배포 후 기존 운영 동작은 바뀌지 않는다.

**Architecture:** 순수 판정 모듈(`permissions.ts`)이 명세서 4.2 매트릭스를 구현하고, 가드 모듈(`require.ts`, `mutation.ts`)이 이를 API, 페이지, 변경 요청에 적용한다. 역할은 세션 토큰에 넣지 않고 요청마다 D1에서 읽는다. 마이그레이션 `0008`은 컬럼만 추가하며 기존 계정을 `officer`, `approved`, 결정권 없음으로 이전한다.

**Tech Stack:** Astro 7, Cloudflare Workers, D1(SQLite), TypeScript 6, Vitest 5, wrangler 4. 현재 Node 기준은 `.nvmrc`와 `package.json`의 26이다. 아래 코드 예시는 작성 당시 기준이므로 현재 공용 모듈과 정책을 우선한다.

**Spec:** `docs/superpowers/specs/2026-10-12-boards-and-roles-design.md` (2026-10-14 개정본, 커밋 `14751c9`). 이 계획은 명세서 13장의 1단계 행을 구현한다.

## 현재 진행 상태 (2026-10-20)

Phase 1 구현은 완료되었다. `origin/main` 이후의 구현 커밋에서 Task 1~9와 Task 10의 문서·CHANGELOG 반영까지 완료되었으며, 다음 검증도 통과했다.

- `npm test`: 67개 파일, 720개 테스트 통과
- `npm run check`: 오류·경고·힌트 0개
- `npm run test:roles:d1`: backfill, 기본값, 제약조건 검증 통과

단계별 체크박스는 실제 완료 상태가 갱신되지 않은 과거 작업 지침이다. 현재 진행 상태는 아래 표를 기준으로 본다. 2026-10-20 기준선 확인에서는 단위 테스트·타입 검사·역할 D1 검증을 재실행했다. 전체 기능의 최종 빌드·감사·브라우저 검증은 통합 구현 완료 후 수행하며, 과거 다른 세션의 실행 여부를 이 문서만으로 단정하지 않는다.

| 작업              | 현재 상태 | 근거                                                                      |
| ----------------- | --------- | ------------------------------------------------------------------------- |
| Task 1~3          | 완료      | `0008` 마이그레이션, 사용자 모델, 권한 판정 모듈 및 테스트 반영           |
| Task 4~5          | 완료      | 세션 사용자 조회, API·페이지 가드, 공용 변경 요청 가드 및 Q&A 호환성 반영 |
| Task 6~8          | 완료      | API·관리자 페이지 교체, `/api/auth/me`, 경로 가드 커버리지 테스트 반영    |
| Task 9            | 완료      | `create-user`, `set-user-role`, `--dry-run`, CI 호출 수정 반영            |
| Task 10 문서화    | 완료      | 운영 런북, README, `CONTENT_ARCHITECTURE.md`, `CHANGELOG.md` 반영         |
| Task 10 최종 검증 | 로컬 완료 | Phase 2 통합 빌드·감사·브라우저 검증까지 수행. 운영 배포는 미실행         |

통합 Phase 2의 로컬 구현·검증도 완료했다. 최신 결과는 [검증 기록](../../phase2-verification.md)과 [Phase 2 계획](2026-10-20-forum-and-user-management.md)을 따른다. 다음 작업은 사용자 로컬 확인과 실제 운영 계정 대조이며, 운영 변경·통합 배포는 별도 승인이 필요하다. 신규 비공개 기능은 초기 운영 계정 검증 전까지 닫아 둔다.

### 후속 명세 반영 사항

이 계획 작성 이후 Obsidian 기능 요약에서 다음 요구사항이 추가로 확정되었다. Phase 2 계획에 반드시 반영한다.

- 감사와 고문은 사이트 등급을 `member`로 유지한다.
- 감사·고문은 총회 게시판과 Q&A 질문 작성이 가능하고, 임원 게시판도 열람·작성할 수 있다.
- 감사·고문에게는 이사진의 세미나 글 작성·수정, 미디어 관리, Q&A 공식 답변 권한을 주지 않는다.
- 감사·고문은 `member` 등급에 `can_access_directors_forum` 플래그를 추가한다. 이름·가입 시점으로 접근을 허용하지 않고 현재 승인 상태와 부여된 권한으로 판정한다. 신규 가입도 이후 임명·권한 변경이 있으면 같은 기준을 따른다.
- 현재 명단의 감사·고문을 포함한 7명은 총회 게시판과 Q&A 질문 작성이 가능하다. 신규 가입자는 준회원으로 시작하며 같은 두 기능을 사용할 수 있지만 임원 게시판과 운영 기능은 사용할 수 없다.
- 회장·부회장(결정권자)은 일반 회원·준회원·이사진·감사·고문 계정의 역할과 결정권을 관리할 수 있다.
- 회장·부회장은 자기 자신과 변경 전 결정권자의 상태·역할·결정권·특별 접근을 변경할 수 없다. 새로 결정권을 받은 계정도 보호한다. 교체·해제는 별도 운영 절차로 처리하며, 상태 변경으로 보호를 우회하지 못하게 서버에서 강제한다.

## 계정 명단 및 권한 등급 확인 (2026-10-20)

### 공개 명단 기준

`src/data/members.json`의 현재 명단은 7명이다. 명세서의 D2 기준(회장·부회장·이사만 officer)에 따라 직함을 사이트 역할로 매핑하면 다음과 같다.

| 공개 명단                | 직함                  | 사이트 역할                      | 결정권             | 비고                                        |
| ------------------------ | --------------------- | -------------------------------- | ------------------ | ------------------------------------------- |
| Dr. Wonjoon Kim          | President             | `officer`                        | `is_executive = 1` | 최고 결정권자                               |
| Dr. SeongHo Jun          | Senior Vice President | `officer`                        | `is_executive = 1` | 수석부회장도 부회장으로 포함, 최고 결정권자 |
| Dr. Vilayphone Somsamone | Director              | `officer`                        | `is_executive = 0` | 이사                                        |
| Dr. Zhang Wen            | Director              | `officer`                        | `is_executive = 0` | 이사                                        |
| Dr. Gozal Shamuratova    | Director              | `officer`                        | `is_executive = 0` | 이사                                        |
| Dr. Le Lan Huong         | Auditor               | `member` + 임원 게시판 특별 접근 | `is_executive = 0` | 감사는 officer가 아님                       |
| John O. Lee              | Senior Advisor        | `member` + 임원 게시판 특별 접근 | `is_executive = 0` | 고문은 officer가 아님                       |

여기서 `is_executive = 1`은 시스템상 가능한 최고 권한인 결정권자 등급을 뜻한다. 별도의 super-admin 권한은 만들지 않으며, 실제 데이터 변경은 승인된 `officer` 계정에만 적용된다. 회장과 수석부회장은 가입 승인·반려와 다른 사람의 forum 글 숨김 권한을 갖고, 이사 계정은 일반 officer 권한만 갖는다.

### 현재 계정 확인 결과

운영 계정 명단은 Cloudflare 원격 D1에서 확인해야 하며, 현재 세션에서는 원격 D1 인증이 확인되지 않았다. 로컬 D1에는 다음 테스트 계정만 존재한다.

| 로컬 계정    | 표시 이름      | 현재 상태                              |
| ------------ | -------------- | -------------------------------------- |
| `qna-admin`  | Q&A Test Admin | `0008` 적용 전이라 역할 컬럼 확인 불가 |
| `rlawnguq12` | 김주협         | `0008` 적용 전이라 역할 컬럼 확인 불가 |
| `testadmin`  | Test Admin     | `0008` 적용 전이라 역할 컬럼 확인 불가 |

따라서 위 테스트 계정은 공개 명단의 7명과 자동 매칭하지 않는다. `0008`을 적용한 뒤에도 로컬 테스트 계정은 기능 확인용으로만 유지하고, 운영 계정 조정은 원격 D1에서 실제 username을 확인한 후 수행한다.

### 역할 조정 절차

운영 계정과 공개 명단의 매칭 및 조정은 네 단계로 나눈다.

1. **조회·매칭:** 원격 D1에서 `username`, `display_name`, `role`, `status`, `is_executive`를 조회하고 `members.json`의 이름·직함과 대조한다.
2. **비officer 조정:** Auditor·Senior Advisor는 approved member + can_access_directors_forum = 1로 조정한다. Phase 2에서 `set-user-forum-access.mjs`를 구현했다. 역할 변경과 특별 접근 지정은 별개 명령이며 수행자·감사 기록을 포함한다. 운영 반영은 승인된 릴리스 절차에서 수행한다.
3. **officer 조정:** President·Senior Vice President·Director 계정은 승인 상태를 확인한 뒤 `--role officer`로 변경한다. `status != approved`인 계정에는 스크립트가 officer 역할을 부여하지 않는다.
4. **결정권 지정·검증:** President와 Senior Vice President에만 `--role officer --executive`를 적용하고, 조회 SQL로 최종 결과를 재확인한다. 이사·감사·고문 계정은 `is_executive = 0`이어야 한다. 회장·부회장 계정은 서로의 역할·결정권을 변경할 수 없도록 사용자 관리 규칙을 확인한다.

운영 변경은 항상 `--dry-run`으로 SQL을 먼저 확인한 뒤 실제 명령을 실행한다. 예시는 다음과 같다.

```bash
npx wrangler d1 execute tcn-content --remote \\
  --command "select username, display_name, role, status, is_executive from users order by username"

node scripts/set-user-role.mjs <username> --role member --remote --dry-run
node scripts/set-user-role.mjs <username> --role member --remote

node scripts/set-user-role.mjs <president-username> --role officer --executive --remote --dry-run
node scripts/set-user-role.mjs <president-username> --role officer --executive --remote
node scripts/set-user-role.mjs <senior-vice-president-username> --role officer --executive --remote
```

## Global Constraints

명세서에서 가져온 값은 그대로 적었다. 모든 작업은 이 절을 암묵적으로 포함한다.

- "마이그레이션은 기존 규칙에 따라 추가만 하고, 번호는 main 의 마지막 번호 다음부터 쓴다." main 의 마지막이 `0007_login_lock_escalation.sql`(보안 강화)이라 이 계획의 파일은 `migrations/0008_user_roles.sql`이다.
- "기존 운영 동작을 1단계 배포에서 바꾸지 않는다." 기존 계정은 모두 `officer`, `approved`, `is_executive = 0`으로 이전하고, 세미나 글·미디어·Q&A 답변 권한은 그대로 유지한다.
- "역할, 상태, 결정권은 세션 토큰에 넣지 않고 요청마다 D1에서 읽는다." 세션 토큰 형식과 세션 버전 규칙은 바꾸지 않는다.
- "Q&A는 기존 접두사를 그대로 쓰므로 이미 열려 있는 관리 화면의 토큰이 배포 때문에 무효가 되지 않는다. 오류 클래스 이름만 공용 이름으로 바꾸고, 상태 코드와 오류 코드 문자열은 그대로 유지한다."
- 권한 부족 응답은 403 `forbidden`, 비로그인 응답은 401 `unauthorized`다.
- 결정권은 `status = approved`, `role = officer`, `is_executive = 1`을 모두 만족할 때만 인정한다. 권한은 `status`를 먼저 확인한다.
- 1단계에서 `admin/login`의 `/login` 이동, 로그인 API 응답 필드 추가, 사용자 관리 화면은 하지 않는다(3단계).
- 문서 개정은 `docs/operations-runbook.md`와 `CHANGELOG.md`가 중심이다. 예외 두 가지는 아래 "명세서와 다르게 정한 점" 4번에 적었다.
- `AGENTS.md` 규칙: 동작 변경은 TDD로 구현하고, 완료를 주장하기 전에 `superpowers:verification-before-completion`으로 새로 검증하며, push와 PR 전에 `pr-changelog` 스킬을 적용한다. Spec Kit은 쓰지 않는다.
- `.claude/settings.json`과 `.mcp.json`은 untracked 상태로 두고 커밋하지 않는다. 커밋할 때는 항상 파일 경로를 직접 지정해 `git add`한다.
- 커밋 메시지는 저장소 관례대로 영어 conventional 형식이다.

## 계획 작성 중 확인한 사실

인수인계 문서와 명세서에 없거나 다르던 내용을 실측으로 확인했다.

1. **`getSessionUid` 사용 파일은 17개가 맞고 명세서의 15개와도 일치한다.** 17개 중 2개(`src/lib/auth/guard.ts`, `src/lib/auth/index.ts`)는 정의와 재노출이고, 실제 소비처가 15개다. 명세서 6.3의 11개(교체)와 4개(유지)가 그 15개다.
2. **명세서 5.1이 불확실하다고 남긴 항목은 해소되었다.** 로컬 D1에서 `alter table add column`에 `not null default`, `check`, `references users(id)`를 함께 쓸 수 있고, 허용 값 밖의 값(`role = 'admin'`, `status = 'banned'`, `is_executive = 2`, `revision = 0`, 존재하지 않는 `decided_by`)은 모두 거부된다. 외래 키는 `pragma foreign_keys = on` 없이도 강제된다. 따라서 `check` 제약을 그대로 쓰고, 애플리케이션 계층 검증으로 대신할 필요가 없다.
3. **배포 워크플로는 원격 D1 마이그레이션을 코드 배포 앞에서 적용한다.** `.github/workflows/deploy-workers.yml`의 순서는 Time Travel 북마크 기록, `wrangler d1 migrations apply tcn-content --remote`, Worker 배포, 트래픽 확인이다. 따라서 새 코드가 `role` 컬럼을 읽는 시점에는 컬럼이 이미 있다. 마이그레이션이 추가만 하므로 이전 Worker도 새 스키마에서 동작하고, 롤백에 데이터 복구가 필요하지 않다. 인수인계 문서가 확인하지 못했다고 한 항목이다.
4. **`scripts/verify-admin-authoring.mjs`가 `create-user.mjs`를 `--role` 없이 호출한다(45행).** `--role`을 필수로 만들면 CI의 `verify:admin`이 깨진다. 명세서에 없는 수정이며 Task 9에 포함했다.
5. **`wrangler d1 execute --json` 출력에는 `meta.changes`가 없다.** 그래서 `set-user-role.mjs`는 변경 건수 대신 `update` 뒤의 `select` 결과 행을 읽어 성공을 판정한다(출력 형태는 로컬에서 확인했다).
6. **`password-script-parity.test.ts`가 `create-user.mjs`를 정규식으로 읽는다.** `ITERATIONS`, 저장 포맷 문자열, `hash: 'SHA-256'`, 키 길이, salt 길이를 담은 줄을 바꾸면 이 테스트가 깨진다. Task 9에서 `hashPassword` 함수는 건드리지 않는다.
7. **Q&A 답변·공개 전환 API(`answer.ts`, `visibility.ts`)는 `getSessionUid`를 직접 쓰지 않고 `handleAdminQuestionMutation`을 거쳐 `requireAdminMutation`에 닿는다.** 커버리지 테스트가 이 두 파일을 통과시키려면 이 래퍼를 가드로 인정해야 한다(Task 8).
8. **`src/test-support/d1.ts`가 `node:sqlite`로 모든 마이그레이션을 vitest 안에서 적용하는 하네스를 이미 제공한다.** `0008`이 이 하네스에서도 적용되는지 확인했다(`rate-limit.d1.test.ts` 통과). 이 계획은 명세서 12장대로 wrangler 기반 `test:roles:d1`을 쓰므로 하네스는 건드리지 않는다.
9. **계획의 코드 블록 일부를 임시 복사본에서 실행해 검증했다.**
   - 검증한 범위: Task 1의 마이그레이션과 D1 검증 스크립트(마이그레이션이 없으면 실패하고 있으면 통과한다), `set-user-role.mjs`의 로컬 D1 실행(승격, 결정권 부여와 해제, 없는 계정, 미승인 계정, 인자 오류, `--dry-run`), Task 3·4·5의 모듈과 테스트(`permissions`, `require`, `mutation`, `guard`, `users`), Task 9의 `create-user.mjs` 수정본과 `user-scripts.test.ts`, Task 6의 대표 사례(`media-cleanup` 라우트와 테스트), Task 8의 `me` 라우트와 커버리지 테스트. 커버리지 테스트는 가드를 교체하지 않은 경로 9개와 래퍼 확인 1건에서만 정확히 실패했다. 복사본 전체에서 56개 테스트 파일 중 55개, 488개 테스트가 통과했고, 실패한 1개(`routing.test.ts`)는 복사본에 `astro.config.mjs`가 없어서 생긴 환경 문제다.
   - 이 과정에서 `users.test.ts`의 `./client` 모킹 누락을 찾아 고쳤다.
   - 검증하지 못한 범위: Task 5의 Q&A 쪽 수정(`qna/security.ts`, `admin-route.ts`와 두 테스트 파일), Task 6의 나머지 네 라우트와 테스트, Task 7의 페이지 다섯 개, `npm run check`(타입 검사)와 `npm run build`. 이 부분은 구현 중에 각 작업의 검증 단계로 확인한다.

## 명세서와 다르게 정한 점 (검토 때 확인해 주세요)

1. **비임원 계정이 어드민 페이지에 들어오면 일반 텍스트 403을 돌려준다.** 명세서 6.1은 "안내 화면"을 말하지만, 안내 화면을 갖는 `/account`는 3단계에 생긴다. 1단계에서는 임원이 아닌 계정이 운영에 존재하지 않는다(가입이 없고 기존 계정은 모두 임원이다). 그래서 별도 화면을 만들지 않고 `Forbidden` 텍스트 응답으로 둔다. 3단계에서 안내 화면으로 바꾼다.
2. **비로그인 페이지 접근은 `/admin/login`으로 보낸다.** 명세서 6.1의 `/login`은 3단계에 생긴다. 페이지 가드는 `loginUrl` 옵션을 받아 Q&A 화면의 기존 `returnTo` 동작을 그대로 유지한다.
3. **`api/posts`와 `api/media` 쓰기 경로에는 CSRF 검사를 추가하지 않는다.** 이 경로들은 지금도 세션만 확인하고(쿠키는 `SameSite=Lax`), 1단계 목표는 동작 보존이다. 임원 가드(`requireOfficer`)만 적용한다. CSRF 도입은 별도 과제로 남긴다.
4. **문서 두 곳의 한 줄 수정을 1단계에 포함한다.** `README.md`와 `CONTENT_ARCHITECTURE.md`의 `create-user.mjs` 사용 예시는 `--role`이 필수가 되면 오류가 나는 명령이 된다. 명세서는 `CONTENT_ARCHITECTURE.md` 개정을 2단계로 정했지만, 틀린 명령을 한 단계 동안 남기지 않으려고 명령 예시 한 줄만 고친다. `README.md`의 "권한은 flat" 문장도 같은 이유로 고친다.
5. **커버리지 테스트가 인정하는 가드 이름에 `handleAdminQuestionMutation`을 더한다.** 명세서 6.4의 목록은 네 개다. 앞의 사실 7 때문에 필요하다. 이 래퍼가 `requireMutation`을 `require: 'officer'`로 부르는지는 같은 테스트 파일이 별도로 확인한다.
6. **스크립트에 `--dry-run`을 둔다.** 운영 D1에 쓰기 전에 실행될 SQL을 먼저 볼 수 있게 한다. 명세서에는 없는 기능이지만 `--remote` 실행의 안전장치이고, 스크립트를 자식 프로세스로 실행해 테스트할 수 있게 해 준다(`.mjs`를 TypeScript 테스트에서 import하면 `astro check`가 타입 오류를 낸다).
7. **`set-user-role.mjs`는 결과 상태를 인자로 완전히 정한다.** `--executive`를 주면 결정권이 켜지고, 주지 않으면 꺼진다. 현재 값을 암묵적으로 유지하는 인자 조합은 없다. `--role officer`는 `status = approved`인 계정에만 적용된다(4.1: 임원 권한은 승인된 계정에서만 유효).
8. **D1 제약 테스트는 새 스크립트 `scripts/verify-roles-d1.mjs`(`npm run test:roles:d1`)로 둔다.** 기존 `verify-qna-d1.mjs`는 Q&A 전용이다. 이 스크립트는 `0006`까지 적용한 뒤 기존 계정을 넣고 `0008`을 적용해 이전 결과를 검증하므로, "마이그레이션 후 기존 계정 동작 보존" 회귀 테스트의 데이터 부분을 맡는다. 권한 부분은 `permissions.test.ts`가 맡는다. CI에 단계를 하나 추가한다.

## Review Focus

명세서가 암시하지만 개별 작업의 테스트가 우연히 덮지 않을 수 있는 입력과 실패 양상이다. 가장 위험한 것부터 적었고, 각 항목의 테스트는 해당 코드를 소유한 작업에 넣었다.

1. **`is_executive = 1`인데 승인된 임원이 아닌 계정.** 일반 회원, 승인 대기 임원, 반려된 임원에게 결정권이 새면 타인 글 숨김과 가입 승인이 열린다. 기대 동작은 결정권이 무시되는 것이다. (Task 3, Task 5)
2. **역할은 `officer`인데 상태가 `pending` 또는 `rejected`인 계정.** 상태를 먼저 확인하지 않으면 반려된 임원이 어드민에 들어온다. 기대 동작은 `pending`이면 준회원 권한만, `rejected`이면 공개 기능과 `/account`만 갖는 것이다. (Task 3, Task 4)
3. **배포 전에 열려 있던 Q&A 관리 화면의 CSRF 토큰.** 접두사가 바뀌면 배포 직후 편집 화면의 모든 저장이 `invalid_csrf`로 실패한다. 기대 동작은 기존 `qna-csrf:` 형식의 토큰이 그대로 통과하는 것이다. (Task 5)
4. **무효화된 세션과 삭제된 계정.** 세션 버전이 맞지 않거나 계정이 지워졌으면 403이 아니라 401이어야 하고, `getSessionUid`와 `getSessionUser`가 같은 결론을 내야 한다. (Task 4)
5. **`--role` 누락, `member`에 `--executive`, 승인되지 않은 계정에 `officer` 부여.** 스크립트가 조용히 성공한 척하면 의도하지 않은 권한이 생기거나 부여했다고 믿는 권한이 없다. 기대 동작은 모두 오류 종료이고 `--dry-run` 외에는 SQL을 실행하지 않는 것이다. (Task 9)

## 파일 구조

**새로 만드는 파일**

| 파일                                                                      | 책임                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `migrations/0008_user_roles.sql`                                          | 사용자 컬럼 추가와 기존 계정 이전                           |
| `scripts/verify-roles-d1.mjs`                                             | 마이그레이션 이전 결과와 제약을 로컬 D1로 검증              |
| `scripts/set-user-role.mjs`                                               | 역할과 결정권을 바꾸는 운영자 스크립트                      |
| `src/lib/auth/permissions.ts`                                             | 순수 모듈. 등급 계산, 요구 조건 판정, `canAccess` 매트릭스  |
| `src/lib/auth/require.ts`                                                 | API용·페이지용 가드(`requireOfficer` 등)                    |
| `src/lib/auth/mutation.ts`                                                | 오류 클래스, 동일 출처 검사, 범위별 CSRF, `requireMutation` |
| `src/lib/auth/permissions.test.ts`, `require.test.ts`, `mutation.test.ts` | 위 세 모듈의 단위 테스트                                    |
| `src/lib/auth/route-guard-coverage.test.ts`                               | 경로 파일이 가드를 호출하는지 확인                          |
| `src/lib/auth/user-scripts.test.ts`                                       | 두 스크립트의 인자 검증과 `--dry-run` SQL 확인              |
| `src/lib/db/users.test.ts`                                                | 사용자 행 매핑 테스트                                       |

**수정하는 파일**

| 파일                                                                                                                                                                                                       | 변경                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/lib/db/types.ts`, `src/lib/db/users.ts`                                                                                                                                                               | `User`에 `role`, `status`, `isExecutive` 추가              |
| `src/lib/auth/guard.ts`, `guard.test.ts`                                                                                                                                                                   | `getSessionUser` 추가. `getSessionUid`는 같은 조회를 공유  |
| `src/lib/auth/index.ts`                                                                                                                                                                                    | 새 모듈의 공개 API 재노출                                  |
| `src/lib/qna/security.ts`, `security.test.ts`                                                                                                                                                              | 공용 모듈로 이동한 부분 제거, `QnaSecurityError` 별칭 유지 |
| `src/lib/qna/admin-route.ts`                                                                                                                                                                               | `requireMutation('qna', 'officer')` 사용                   |
| `src/pages/api/posts/index.ts`, `posts/[id].ts`, `media/index.ts`, `media/[id].ts`, `maintenance/media-cleanup.ts`                                                                                         | `requireOfficer`로 교체                                    |
| `src/pages/api/auth/me.ts`                                                                                                                                                                                 | `getSessionUser` 사용, 응답에 `role`, `status` 추가        |
| `src/pages/admin/index.astro`, `posts/new.astro`, `posts/[id].astro`, `questions/index.astro`, `questions/[id].astro`                                                                                      | `requireOfficerPage`로 교체                                |
| `src/lib/routes/api-posts-route.test.ts`, `api-media-route.test.ts`, `api-media-upload-route.test.ts`, `api-media-cleanup-route.test.ts`, `api-auth-session-routes.test.ts`, `api-qna-admin-route.test.ts` | 가드 변경에 맞춰 모킹 수정, 403 테스트 추가                |
| `scripts/create-user.mjs`, `scripts/verify-admin-authoring.mjs`                                                                                                                                            | `--role` 필수화, `--dry-run`, CI 호출 수정                 |
| `package.json`, `.github/workflows/ci.yml`                                                                                                                                                                 | `test:roles:d1` 추가                                       |
| `docs/operations-runbook.md`, `README.md`, `CONTENT_ARCHITECTURE.md`, `CHANGELOG.md`                                                                                                                       | 운영 절차와 명령 예시                                      |

**변경하지 않는 파일:** `api/auth/login.ts`, `api/auth/logout.ts`, `api/questions/index.ts`, `admin/login.astro`, `src/middleware.ts`(헤더 확장은 2단계), `src/lib/db/users.ts`의 `createUser`(어디서도 쓰이지 않고, 새 기본값은 의도적으로 최소 권한이다).

## 작업 순서와 의존

```
Task 1 마이그레이션 ─┐
Task 2 사용자 모델 ──┼─ Task 4 가드 ─┬─ Task 5 변경 요청 가드 ─┬─ Task 6 API 교체 ─┐
Task 3 권한 판정 ────┘               │                          └─ Task 7 페이지 교체 ┼─ Task 8 me와 커버리지 ─ Task 10 문서·최종 검증
                                      └──────────────────────────────── Task 9 스크립트 ┘
```

Task 1~3은 서로 독립이다. 각 작업은 끝날 때 커밋하며 모든 커밋에서 `npm test`가 통과해야 한다.

---

### Task 1: 마이그레이션 `0008`과 D1 검증 스크립트

**Files:**

- Create: `scripts/verify-roles-d1.mjs`
- Create: `migrations/0008_user_roles.sql`
- Modify: `package.json` (scripts)
- Modify: `.github/workflows/ci.yml` (`Verify Q&A D1 constraints` 단계 다음)

**Interfaces:**

- Consumes: 없음.
- Produces: `users` 테이블의 컬럼 `role`, `status`, `affiliation`, `is_executive`, `revision`, `decided_by`, `decided_at`. Task 2가 `role`, `status`, `is_executive`를 읽는다.

- [ ] **Step 1: 검증 스크립트를 먼저 쓴다**

`scripts/verify-roles-d1.mjs`:

```js
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const state = mkdtempSync(join(tmpdir(), 'tcn-roles-d1-'));
const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler');
const ROLES_MIGRATION = '0008_user_roles.sql';

function run(args, { expectFailure = false } = {}) {
  const result = spawnSync(wrangler, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });
  if (expectFailure) {
    assert.notEqual(
      result.status,
      0,
      `Expected command to fail:\n${result.stdout}\n${result.stderr}`,
    );
  } else {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function execute(sql, options) {
  return run(
    ['d1', 'execute', 'tcn-content', '--local', '--persist-to', state, '--command', sql, '--json'],
    options,
  );
}

function executeFile(file) {
  return run([
    'd1',
    'execute',
    'tcn-content',
    '--local',
    '--persist-to',
    state,
    '--file',
    join('migrations', file),
  ]);
}

const rows = (sql) => JSON.parse(execute(sql))[0].results;

try {
  const migrations = readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort();
  assert.ok(migrations.includes(ROLES_MIGRATION), `${ROLES_MIGRATION} is missing`);

  // 0008 이전 스키마에서 수동 발급 계정을 만든 뒤 0008 을 적용한다. 이전 결과를 검증하려면
  // 역할 컬럼이 없던 시점의 행이 필요하다.
  for (const file of migrations.filter((name) => name < ROLES_MIGRATION)) executeFile(file);
  execute(
    `insert into users (id, username, password_hash, display_name) values
       ('legacy-1', 'editor', 'hash', 'Editor'),
       ('legacy-2', 'admin', 'hash', null)`,
  );
  executeFile(ROLES_MIGRATION);

  const migrated = {
    role: 'officer',
    status: 'approved',
    is_executive: 0,
    revision: 1,
    decided_by: null,
    decided_at: null,
    affiliation: null,
  };
  assert.deepEqual(
    rows(
      `select username, role, status, is_executive, revision, decided_by, decided_at, affiliation
       from users order by username`,
    ),
    [
      { username: 'admin', ...migrated },
      { username: 'editor', ...migrated },
    ],
  );

  // 마이그레이션 뒤에 만든 행은 가장 낮은 권한이 기본값이다.
  execute(`insert into users (id, username, password_hash) values ('new-1', 'new-user', 'hash')`);
  assert.deepEqual(
    rows(`select role, status, is_executive, revision from users where id = 'new-1'`),
    [{ role: 'member', status: 'pending', is_executive: 0, revision: 1 }],
  );

  for (const sql of [
    `update users set role = 'admin' where id = 'new-1'`,
    `update users set status = 'banned' where id = 'new-1'`,
    `update users set is_executive = 2 where id = 'new-1'`,
    `update users set revision = 0 where id = 'new-1'`,
    `update users set decided_by = 'missing-user' where id = 'new-1'`,
  ]) {
    execute(sql, { expectFailure: true });
  }

  execute(
    `update users set status = 'approved', decided_by = 'legacy-1', decided_at = 1760000000,
       revision = 2 where id = 'new-1'`,
  );
  assert.deepEqual(rows(`select status, decided_by, revision from users where id = 'new-1'`), [
    { status: 'approved', decided_by: 'legacy-1', revision: 2 },
  ]);

  const integrity = JSON.parse(execute('pragma foreign_key_check'));
  assert.equal(integrity[0].results.length, 0);
  console.log('PASS: user role migration (backfill, defaults, constraints)');
} finally {
  rmSync(state, { recursive: true, force: true });
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node scripts/verify-roles-d1.mjs`
Expected: `AssertionError ... 0008_user_roles.sql is missing`로 종료 코드 1.

- [ ] **Step 3: 마이그레이션을 작성한다**

`migrations/0008_user_roles.sql`:

```sql
-- 역할·상태·결정권. 추가만 하는 마이그레이션이라 이전 Worker가 새 컬럼을 무시해도 호환된다.
-- 기본값은 가장 낮은 권한(member, pending, 결정권 없음)이다. 새 행이 실수로 임원 권한을
-- 갖지 않게 하기 위해서다.
alter table users add column role text not null default 'member'
  check (role in ('officer', 'member'));
alter table users add column status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));
alter table users add column affiliation text;
alter table users add column is_executive integer not null default 0
  check (is_executive in (0, 1));
alter table users add column revision integer not null default 1 check (revision >= 1);
alter table users add column decided_by text references users(id);
alter table users add column decided_at integer;

-- 수동 발급 계정은 지금 모든 권한을 가지고 있으므로 동작을 유지한다. 결정권은 주지 않는다.
update users set role = 'officer', status = 'approved';
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node scripts/verify-roles-d1.mjs`
Expected: `PASS: user role migration (backfill, defaults, constraints)`

Run: `npm run test:qna:d1`
Expected: 기존 `PASS: Q&A local D1 migration and integrity checks (11 assertions)`가 그대로 나온다. 이 스크립트가 `users`에 `role` 없이 행을 넣는데, 기본값 덕분에 계속 통과해야 한다.

- [ ] **Step 5: npm 스크립트와 CI 단계를 추가한다**

`package.json`의 `"test:qna:d1"` 줄 아래에 추가한다.

```json
    "test:roles:d1": "node scripts/verify-roles-d1.mjs",
```

`.github/workflows/ci.yml`에서 `Verify Q&A D1 constraints` 단계(`run: npm run test:qna:d1`) 바로 아래에 추가한다.

```yaml
- name: Verify user role migration
  run: npm run test:roles:d1
```

Run: `npm run test:roles:d1`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add migrations/0008_user_roles.sql scripts/verify-roles-d1.mjs package.json .github/workflows/ci.yml
git commit -m "feat(db): add user role, status and executive columns"
```

---

### Task 2: 사용자 모델 확장

**Files:**

- Create: `src/lib/db/users.test.ts`
- Modify: `src/lib/db/types.ts` (`User` 인터페이스, 66~73행 부근)
- Modify: `src/lib/db/users.ts`

**Interfaces:**

- Consumes: Task 1의 컬럼.
- Produces: `UserRole = 'officer' | 'member'`, `AccountStatus = 'pending' | 'approved' | 'rejected'`(둘 다 `src/lib/db/types.ts`에서 내보낸다). `User`에 `role: UserRole`, `status: AccountStatus`, `isExecutive: boolean`. `getUserById`와 `getUserByUsername`이 `isExecutive`를 boolean으로 돌려준다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/db/users.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

// client.ts 가 cloudflare:workers 를 import 하므로 다른 db 테스트(posts.test.ts)처럼 모킹한다.
vi.mock('./client', () => ({ newId: vi.fn(() => 'new-id') }));

import { getUserById, getUserByUsername } from './users';

const ROW = {
  id: 'u1',
  username: 'editor',
  passwordHash: 'hash',
  displayName: null,
  sessionVersion: 1,
  createdAt: 1,
  role: 'officer',
  status: 'approved',
};

function fakeDb(row: Record<string, unknown> | null) {
  const statements: string[] = [];
  const db = {
    prepare(sql: string) {
      statements.push(sql);
      return { bind: () => ({ first: async () => row }) };
    },
  } as unknown as D1Database;
  return { db, statements };
}

describe('user rows', () => {
  it('selects the role, status and executive columns', async () => {
    const { db, statements } = fakeDb({ ...ROW, isExecutive: 0 });
    await getUserById(db, 'u1');
    expect(statements[0]).toContain('role');
    expect(statements[0]).toContain('status');
    expect(statements[0]).toContain('is_executive as isExecutive');
  });

  it('maps the stored 0/1 executive flag to a boolean', async () => {
    const on = await getUserById(fakeDb({ ...ROW, isExecutive: 1 }).db, 'u1');
    const off = await getUserByUsername(fakeDb({ ...ROW, isExecutive: 0 }).db, 'editor');
    expect(on?.isExecutive).toBe(true);
    expect(off?.isExecutive).toBe(false);
  });

  it('returns null when no row matches', async () => {
    expect(await getUserById(fakeDb(null).db, 'missing')).toBeNull();
    expect(await getUserByUsername(fakeDb(null).db, 'missing')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/db/users.test.ts`
Expected: FAIL. `selects the role, status and executive columns`와 `maps the stored 0/1 executive flag to a boolean`이 실패한다.

- [ ] **Step 3: 구현한다**

`src/lib/db/types.ts`의 `User`를 다음으로 바꾼다.

```ts
export type UserRole = 'officer' | 'member';
export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string | null;
  sessionVersion: number;
  createdAt: UnixSeconds;
  role: UserRole;
  status: AccountStatus;
  // 결정권(회장·부회장). status 가 approved 이고 role 이 officer 일 때만 의미를 가진다.
  isExecutive: boolean;
}
```

`src/lib/db/users.ts`의 상단 `COLUMNS`와 두 조회 함수를 바꾼다.

```ts
import { newId } from './client';
import type { User } from './types';

const COLUMNS = `id, username, password_hash as passwordHash, display_name as displayName,
  session_version as sessionVersion, created_at as createdAt,
  role, status, is_executive as isExecutive`;

type UserRow = Omit<User, 'isExecutive'> & { isExecutive: number };

// SQLite 에는 boolean 이 없어 0/1 로 저장된다.
function toUser(row: UserRow): User {
  return { ...row, isExecutive: row.isExecutive === 1 };
}

// 비밀번호 비교는 auth 레이어에서 수행한다.
export async function getUserByUsername(db: D1Database, username: string): Promise<User | null> {
  const row = await db
    .prepare(`select ${COLUMNS} from users where username = ?1`)
    .bind(username)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare(`select ${COLUMNS} from users where id = ?1`)
    .bind(id)
    .first<UserRow>();
  return row ? toUser(row) : null;
}
```

`createUser`와 `revokeUserSessions`는 그대로 둔다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/db/users.test.ts`
Expected: 3개 PASS.

Run: `npm run check`
Expected: 오류 0건. `User`를 직접 만드는 타입 지정 픽스처는 이 저장소에 없다(조사에서 확인). 오류가 나면 해당 픽스처에 세 필드를 더한다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/db/types.ts src/lib/db/users.ts src/lib/db/users.test.ts
git commit -m "feat(db): read role, status and executive flag with the user row"
```

---

### Task 3: 권한 판정 모듈 (`permissions.ts`)

**Files:**

- Create: `src/lib/auth/permissions.ts`
- Create: `src/lib/auth/permissions.test.ts`
- Modify: `src/lib/auth/index.ts`

**Interfaces:**

- Consumes: Task 2의 `UserRole`, `AccountStatus`(타입 import만 쓰므로 런타임 의존이 없다).
- Produces (모두 `permissions.ts`에서 내보낸다):
  - `interface SessionUser { id: string; username: string; displayName: string | null; role: UserRole; status: AccountStatus; isExecutive: boolean }`
  - `type Tier = 'associate' | 'member' | 'director' | 'executive'`
  - `type ForumBoard = 'directors' | 'assembly'`, `const FORUM_MIN_TIER: Record<ForumBoard, Tier>`
  - `type Requirement = 'officer' | 'executive' | 'activeAccount'`
  - `tierOf(user: SessionUser | null): Tier | null`
  - `hasTier(user: SessionUser | null, minimum: Tier): boolean`
  - `meetsRequirement(user: SessionUser, requirement: Requirement): boolean`
  - `type Action` (아래 코드 참고), `canAccess(user: SessionUser | null, action: Action): boolean`

등급 이름은 명세서의 "이사진"을 `director`로, "회장·부회장"을 `executive`로 옮겼다. `tierOf`는 비로그인과 `rejected`에 `null`을 돌려준다(4.1: `rejected`는 등급 순서에 넣지 않는다).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/auth/permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  canAccess,
  hasTier,
  meetsRequirement,
  tierOf,
  type Action,
  type SessionUser,
} from './permissions';

function account(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'me',
    username: 'me@example.org',
    displayName: 'Me',
    role: 'member',
    status: 'approved',
    isExecutive: false,
    ...overrides,
  };
}

const PERSONAS = {
  anonymous: null,
  rejected: account({ status: 'rejected' }),
  associate: account({ status: 'pending' }),
  member: account(),
  director: account({ role: 'officer' }),
  executive: account({ role: 'officer', isExecutive: true }),
} satisfies Record<string, SessionUser | null>;

type Persona = keyof typeof PERSONAS;
const COLUMNS: Persona[] = [
  'anonymous',
  'rejected',
  'associate',
  'member',
  'director',
  'executive',
];

const OWN = 'me';
const OTHERS = 'someone-else';

type Row = [boolean, boolean, boolean, boolean, boolean, boolean];

// 명세서 4.2 권한 매트릭스. 열 순서는 COLUMNS 와 같다.
const MATRIX: Array<[string, Action, Row]> = [
  ['seminar read', { kind: 'seminar.read' }, [true, true, true, true, true, true]],
  ['seminar write', { kind: 'seminar.write' }, [false, false, false, false, true, true]],
  ['media write', { kind: 'media.write' }, [false, false, false, false, true, true]],
  ['qna ask', { kind: 'qna.ask' }, [true, true, true, true, true, true]],
  ['qna answer', { kind: 'qna.answer' }, [false, false, false, false, true, true]],
  [
    'directors read',
    { kind: 'forum.read', board: 'directors' },
    [false, false, false, false, true, true],
  ],
  [
    'directors write',
    { kind: 'forum.write', board: 'directors' },
    [false, false, false, false, true, true],
  ],
  [
    'assembly read',
    { kind: 'forum.read', board: 'assembly' },
    [false, false, true, true, true, true],
  ],
  [
    'assembly write',
    { kind: 'forum.write', board: 'assembly' },
    [false, false, true, true, true, true],
  ],
  [
    'assembly edit own',
    { kind: 'forum.edit', board: 'assembly', authorId: OWN },
    [false, false, true, true, true, true],
  ],
  [
    'assembly edit other',
    { kind: 'forum.edit', board: 'assembly', authorId: OTHERS },
    [false, false, false, false, false, false],
  ],
  [
    'assembly delete own',
    { kind: 'forum.delete', board: 'assembly', authorId: OWN },
    [false, false, true, true, true, true],
  ],
  [
    'assembly delete other',
    { kind: 'forum.delete', board: 'assembly', authorId: OTHERS },
    [false, false, false, false, false, true],
  ],
  [
    'directors edit own',
    { kind: 'forum.edit', board: 'directors', authorId: OWN },
    [false, false, false, false, true, true],
  ],
  [
    'directors delete other',
    { kind: 'forum.delete', board: 'directors', authorId: OTHERS },
    [false, false, false, false, false, true],
  ],
  ['users list', { kind: 'users.list' }, [false, false, false, false, false, true]],
  ['users decide', { kind: 'users.decide' }, [false, false, false, false, false, true]],
  ['account view', { kind: 'account.view' }, [false, true, true, true, true, true]],
];

describe('canAccess matrix (spec 4.2)', () => {
  for (const [label, action, expected] of MATRIX) {
    it.each(COLUMNS.map((persona, index) => [persona, expected[index]] as const))(
      `${label}: %s -> %s`,
      (persona, allowed) => {
        expect(canAccess(PERSONAS[persona], action)).toBe(allowed);
      },
    );
  }
});

describe('status is checked before role and executive flag (spec 4.1)', () => {
  const ignoredFlag: Array<[string, SessionUser]> = [
    ['an approved member', account({ isExecutive: true })],
    ['a pending officer', account({ role: 'officer', status: 'pending', isExecutive: true })],
    ['a rejected officer', account({ role: 'officer', status: 'rejected', isExecutive: true })],
  ];

  it.each(ignoredFlag)('ignores is_executive for %s', (_label, user) => {
    expect(canAccess(user, { kind: 'users.list' })).toBe(false);
    expect(canAccess(user, { kind: 'users.decide' })).toBe(false);
    expect(canAccess(user, { kind: 'forum.delete', board: 'assembly', authorId: OTHERS })).toBe(
      false,
    );
    expect(meetsRequirement(user, 'executive')).toBe(false);
  });

  it('gives a pending officer only the associate permissions', () => {
    const pendingOfficer = account({ role: 'officer', status: 'pending' });
    expect(tierOf(pendingOfficer)).toBe('associate');
    expect(canAccess(pendingOfficer, { kind: 'forum.write', board: 'assembly' })).toBe(true);
    expect(canAccess(pendingOfficer, { kind: 'forum.read', board: 'directors' })).toBe(false);
    expect(canAccess(pendingOfficer, { kind: 'seminar.write' })).toBe(false);
    expect(meetsRequirement(pendingOfficer, 'officer')).toBe(false);
  });

  it('gives a rejected officer only public access and the account page', () => {
    const rejectedOfficer = account({ role: 'officer', status: 'rejected' });
    expect(tierOf(rejectedOfficer)).toBeNull();
    expect(canAccess(rejectedOfficer, { kind: 'seminar.read' })).toBe(true);
    expect(canAccess(rejectedOfficer, { kind: 'account.view' })).toBe(true);
    expect(canAccess(rejectedOfficer, { kind: 'forum.write', board: 'assembly' })).toBe(false);
    expect(canAccess(rejectedOfficer, { kind: 'seminar.write' })).toBe(false);
    expect(meetsRequirement(rejectedOfficer, 'officer')).toBe(false);
    expect(meetsRequirement(rejectedOfficer, 'activeAccount')).toBe(false);
  });
});

describe('accounts migrated by 0008 (officer, approved, no executive flag)', () => {
  const migrated = account({ role: 'officer', status: 'approved', isExecutive: false });

  it.each([{ kind: 'seminar.write' }, { kind: 'media.write' }, { kind: 'qna.answer' }] as Action[])(
    'keeps the permission %j',
    (action) => {
      expect(canAccess(migrated, action)).toBe(true);
    },
  );

  it('has no executive authority until an operator grants it', () => {
    expect(canAccess(migrated, { kind: 'users.decide' })).toBe(false);
    expect(tierOf(migrated)).toBe('director');
  });
});

describe('tiers and requirements', () => {
  it('orders anonymous < associate < member < director < executive', () => {
    expect(COLUMNS.map((persona) => tierOf(PERSONAS[persona]))).toEqual([
      null,
      null,
      'associate',
      'member',
      'director',
      'executive',
    ]);
    expect(hasTier(PERSONAS.member, 'associate')).toBe(true);
    expect(hasTier(PERSONAS.associate, 'member')).toBe(false);
    expect(hasTier(null, 'associate')).toBe(false);
  });

  // 기대 배열의 순서는 rejected, associate, member, director, executive다.
  // activeAccount는 rejected만 막고, 나머지 두 요구 조건은 등급으로 판정한다.
  it.each([
    ['officer', [false, false, false, true, true]],
    ['executive', [false, false, false, false, true]],
    ['activeAccount', [false, true, true, true, true]],
  ] as const)('requirement %s from rejected up to executive', (requirement, expected) => {
    const accounts = [
      PERSONAS.rejected,
      PERSONAS.associate,
      PERSONAS.member,
      PERSONAS.director,
      PERSONAS.executive,
    ];
    expect(accounts.map((user) => meetsRequirement(user, requirement))).toEqual(expected);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/auth/permissions.test.ts`
Expected: FAIL. `./permissions`를 찾을 수 없다는 오류.

- [ ] **Step 3: 구현한다**

`src/lib/auth/permissions.ts`:

```ts
import type { AccountStatus, UserRole } from '../db/types';

// 세션이 유효할 때 가드가 돌려주는 계정 정보. 비밀번호 해시와 세션 버전은 담지 않는다.
export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  status: AccountStatus;
  isExecutive: boolean;
}

// 등급 순서: (비로그인) < associate(준회원) < member(회원) < director(이사진) < executive(회장·부회장).
// rejected 는 순서에 넣지 않는다(tierOf 가 null 을 돌려준다).
export type Tier = 'associate' | 'member' | 'director' | 'executive';

const TIER_RANK: Record<Tier, number> = { associate: 1, member: 2, director: 3, executive: 4 };

export type ForumBoard = 'directors' | 'assembly';

// 게시판별 최소 등급. 2단계의 forum 엔진이 같은 표를 쓴다.
export const FORUM_MIN_TIER: Record<ForumBoard, Tier> = {
  directors: 'director',
  assembly: 'associate',
};

export type Requirement = 'officer' | 'executive' | 'activeAccount';

// 상태를 먼저 본다. pending 은 role 과 is_executive 를 무시하고, 결정권은 승인된 임원에게만 유효하다.
export function tierOf(user: SessionUser | null): Tier | null {
  if (!user || user.status === 'rejected') return null;
  if (user.status === 'pending') return 'associate';
  if (user.role === 'member') return 'member';
  return user.isExecutive ? 'executive' : 'director';
}

export function hasTier(user: SessionUser | null, minimum: Tier): boolean {
  const tier = tierOf(user);
  return tier !== null && TIER_RANK[tier] >= TIER_RANK[minimum];
}

export function meetsRequirement(user: SessionUser, requirement: Requirement): boolean {
  switch (requirement) {
    case 'officer':
      return hasTier(user, 'director');
    case 'executive':
      return hasTier(user, 'executive');
    case 'activeAccount':
      return user.status !== 'rejected';
  }
}

export type Action =
  | { kind: 'seminar.read' }
  | { kind: 'seminar.write' }
  | { kind: 'media.write' }
  | { kind: 'qna.ask' }
  | { kind: 'qna.answer' }
  | { kind: 'forum.read'; board: ForumBoard }
  | { kind: 'forum.write'; board: ForumBoard }
  | { kind: 'forum.edit'; board: ForumBoard; authorId: string }
  | { kind: 'forum.delete'; board: ForumBoard; authorId: string }
  | { kind: 'users.list' }
  | { kind: 'users.decide' }
  | { kind: 'account.view' };

// 명세서 4.2 의 매트릭스를 그대로 옮긴 순수 함수다.
export function canAccess(user: SessionUser | null, action: Action): boolean {
  switch (action.kind) {
    case 'seminar.read':
    case 'qna.ask':
      return true;
    case 'seminar.write':
    case 'media.write':
    case 'qna.answer':
      return hasTier(user, 'director');
    case 'forum.read':
    case 'forum.write':
      return hasTier(user, FORUM_MIN_TIER[action.board]);
    case 'forum.edit':
      // 수정은 작성자 본인만. 등급이 내려가 게시판 접근을 잃었으면 본인 글도 수정하지 못한다.
      return hasTier(user, FORUM_MIN_TIER[action.board]) && user?.id === action.authorId;
    case 'forum.delete':
      return (
        hasTier(user, FORUM_MIN_TIER[action.board]) &&
        (user?.id === action.authorId || hasTier(user, 'executive'))
      );
    case 'users.list':
    case 'users.decide':
      return hasTier(user, 'executive');
    case 'account.view':
      return user !== null;
  }
}
```

`src/lib/auth/index.ts` 끝에 추가한다.

```ts
export { canAccess, hasTier, meetsRequirement, tierOf, FORUM_MIN_TIER } from './permissions';
export type { Action, ForumBoard, Requirement, SessionUser, Tier } from './permissions';
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/auth/permissions.test.ts`
Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/permissions.ts src/lib/auth/permissions.test.ts src/lib/auth/index.ts
git commit -m "feat(auth): add tier model and canAccess permission matrix"
```

---

### Task 4: 세션 사용자 조회와 가드 (`getSessionUser`, `require.ts`)

**Files:**

- Modify: `src/lib/auth/guard.ts`, `src/lib/auth/guard.test.ts`
- Create: `src/lib/auth/require.ts`, `src/lib/auth/require.test.ts`
- Modify: `src/lib/auth/index.ts`

**Interfaces:**

- Consumes: Task 2의 `User`, Task 3의 `SessionUser`, `Requirement`, `meetsRequirement`.
- Produces:
  - `getSessionUser(request: Request): Promise<SessionUser | null>` (`guard.ts`). `getSessionUid`는 같은 조회를 공유하며 시그니처가 같다.
  - `type GuardResult = { ok: true; user: SessionUser } | { ok: false; response: Response }` (`require.ts`)
  - API용: `requireOfficer(request)`, `requireExecutive(request)`, `requireActiveAccount(request)`. 모두 `Promise<GuardResult>`이다. 비로그인은 401 `{ ok: false, error: 'unauthorized' }`, 조건 미달은 403 `{ ok: false, error: 'forbidden' }`이다.
  - 페이지용: `requireOfficerPage(context, options?)`, `requireExecutivePage(...)`, `requireActiveAccountPage(...)`. `context`는 `{ request: Request }`, `options`는 `{ loginUrl?: string }`(기본 `/admin/login`)이다. 비로그인은 `loginUrl`로 302, 조건 미달은 `text/plain` 403이다.

- [ ] **Step 1: 가드 테스트를 쓴다**

`src/lib/auth/require.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));

vi.mock('./guard', () => ({ getSessionUser }));

import {
  requireActiveAccount,
  requireActiveAccountPage,
  requireExecutive,
  requireExecutivePage,
  requireOfficer,
  requireOfficerPage,
} from './require';
import type { SessionUser } from './permissions';

function account(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'u1',
    username: 'u1@example.org',
    displayName: 'U1',
    role: 'member',
    status: 'approved',
    isExecutive: false,
    ...overrides,
  };
}

const request = new Request('https://tcn.example/admin');
const context = { request };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('API guards', () => {
  it('answers 401 unauthorized when there is no valid session', async () => {
    getSessionUser.mockResolvedValue(null);
    const result = await requireOfficer(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({ ok: false, error: 'unauthorized' });
  });

  it.each([
    ['a member', account()],
    ['a pending officer', account({ role: 'officer', status: 'pending' })],
    ['a rejected officer', account({ role: 'officer', status: 'rejected' })],
  ])('answers 403 forbidden to %s on an officer route', async (_label, user) => {
    getSessionUser.mockResolvedValue(user);
    const result = await requireOfficer(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({ ok: false, error: 'forbidden' });
  });

  it('lets an approved officer through and returns the user', async () => {
    const officer = account({ role: 'officer' });
    getSessionUser.mockResolvedValue(officer);
    await expect(requireOfficer(request)).resolves.toEqual({ ok: true, user: officer });
  });

  it('keeps an officer without the executive flag out of executive routes', async () => {
    getSessionUser.mockResolvedValue(account({ role: 'officer' }));
    const result = await requireExecutive(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);

    getSessionUser.mockResolvedValue(account({ role: 'officer', isExecutive: true }));
    expect((await requireExecutive(request)).ok).toBe(true);
  });

  it('lets pending accounts use active-account routes but not rejected ones', async () => {
    getSessionUser.mockResolvedValue(account({ status: 'pending' }));
    expect((await requireActiveAccount(request)).ok).toBe(true);

    getSessionUser.mockResolvedValue(account({ status: 'rejected' }));
    const result = await requireActiveAccount(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});

describe('page guards', () => {
  it('redirects a visitor without a session to the default login page', async () => {
    getSessionUser.mockResolvedValue(null);
    const result = await requireOfficerPage(context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(302);
    expect(result.response.headers.get('location')).toBe('/admin/login');
  });

  it('keeps the caller-provided login URL so returnTo survives', async () => {
    getSessionUser.mockResolvedValue(null);
    const loginUrl = '/admin/login?returnTo=%2Fadmin%2Fquestions';
    const result = await requireOfficerPage(context, { loginUrl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.headers.get('location')).toBe(loginUrl);
  });

  it('answers a plain-text 403 that is never cached', async () => {
    getSessionUser.mockResolvedValue(account());
    const result = await requireOfficerPage(context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    expect(result.response.headers.get('content-type')).toContain('text/plain');
    expect(result.response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns the user for qualifying accounts on every page guard', async () => {
    const executive = account({ role: 'officer', isExecutive: true });
    getSessionUser.mockResolvedValue(executive);
    await expect(requireOfficerPage(context)).resolves.toEqual({ ok: true, user: executive });
    await expect(requireExecutivePage(context)).resolves.toEqual({ ok: true, user: executive });
    await expect(requireActiveAccountPage(context)).resolves.toEqual({ ok: true, user: executive });
  });
});
```

`src/lib/auth/guard.test.ts`의 import를 `import { getSessionUid, getSessionUser } from './guard';`로 바꾸고 파일 끝에 추가한다.

```ts
describe('getSessionUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function requestWith(token: string) {
    return new Request('https://tcn.example/admin', {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
  }

  it('returns the public session user without secret fields', async () => {
    const token = await createSessionToken('user-1', env.SESSION_SECRET, { sessionVersion: 4 });
    getUserById.mockResolvedValue({
      id: 'user-1',
      username: 'editor',
      displayName: 'Editor',
      passwordHash: 'must-not-leak',
      sessionVersion: 4,
      createdAt: 1,
      role: 'officer',
      status: 'approved',
      isExecutive: true,
    });

    await expect(getSessionUser(requestWith(token))).resolves.toEqual({
      id: 'user-1',
      username: 'editor',
      displayName: 'Editor',
      role: 'officer',
      status: 'approved',
      isExecutive: true,
    });
  });

  it('treats a revoked session version like getSessionUid does', async () => {
    const token = await createSessionToken('user-1', env.SESSION_SECRET, { sessionVersion: 3 });
    getUserById.mockResolvedValue({ id: 'user-1', sessionVersion: 4 });

    await expect(getSessionUser(requestWith(token))).resolves.toBeNull();
    await expect(getSessionUid(requestWith(token))).resolves.toBeNull();
  });

  it('treats a deleted account as unauthenticated', async () => {
    const token = await createSessionToken('gone', env.SESSION_SECRET, { sessionVersion: 1 });
    getUserById.mockResolvedValue(null);

    await expect(getSessionUser(requestWith(token))).resolves.toBeNull();
  });

  it('returns null without a session cookie', async () => {
    await expect(getSessionUser(new Request('https://tcn.example/admin'))).resolves.toBeNull();
    expect(getUserById).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/auth/require.test.ts src/lib/auth/guard.test.ts`
Expected: FAIL. `./require`를 찾을 수 없고 `getSessionUser`가 내보내지지 않았다는 오류.

- [ ] **Step 3: `guard.ts`를 구현한다**

`src/lib/auth/guard.ts`를 다음으로 바꾼다(`getSessionSecret`은 그대로).

```ts
import { env } from 'cloudflare:workers';
import { getDB, getUserById } from '../db';
import type { User } from '../db';
import { readSessionToken } from './cookie';
import type { SessionUser } from './permissions';
import { verifySessionToken } from './session';

function readSecret(): string | null {
  const value = (env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET;
  return value && value.length > 0 ? value : null;
}

// 서명, 만료, 세션 버전을 모두 통과한 사용자 행. getSessionUid 와 getSessionUser 가 같은 조회를
// 공유하므로 요청당 D1 조회 횟수는 늘지 않는다.
async function resolveSessionUser(request: Request): Promise<User | null> {
  const secret = readSecret();
  if (!secret) return null;
  const token = readSessionToken(request);
  if (!token) return null;
  const result = await verifySessionToken(token, secret);
  if (!result) return null;
  const user = await getUserById(getDB(), result.uid);
  return user && user.sessionVersion === result.sessionVersion ? user : null;
}

export async function getSessionUid(request: Request): Promise<string | null> {
  return (await resolveSessionUser(request))?.id ?? null;
}

// 역할, 상태, 결정권은 토큰이 아니라 요청마다 D1 에서 읽는다. 그래서 승인·반려·역할 변경이
// 즉시 반영된다.
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const user = await resolveSessionUser(request);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    isExecutive: user.isExecutive,
  };
}

export function getSessionSecret(): string {
  const secret = readSecret();
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return secret;
}
```

- [ ] **Step 4: `require.ts`를 구현한다**

`src/lib/auth/require.ts`:

```ts
import { getSessionUser } from './guard';
import { meetsRequirement, type Requirement, type SessionUser } from './permissions';

export type GuardResult = { ok: true; user: SessionUser } | { ok: false; response: Response };

interface PageContext {
  request: Request;
}

interface PageOptions {
  // 비로그인 방문자를 보낼 곳. 기본값은 어드민 로그인이고, returnTo 가 필요한 화면은 직접 넘긴다.
  loginUrl?: string;
}

function jsonError(error: 'unauthorized' | 'forbidden', status: 401 | 403): Response {
  return Response.json({ ok: false, error }, { status });
}

async function guardApi(request: Request, requirement: Requirement): Promise<GuardResult> {
  const user = await getSessionUser(request);
  if (!user) return { ok: false, response: jsonError('unauthorized', 401) };
  if (!meetsRequirement(user, requirement)) {
    return { ok: false, response: jsonError('forbidden', 403) };
  }
  return { ok: true, user };
}

// 안내 화면은 3단계의 /account 와 함께 생긴다. 그때까지는 일반 텍스트로 답한다.
async function guardPage(
  context: PageContext,
  requirement: Requirement,
  options: PageOptions = {},
): Promise<GuardResult> {
  const user = await getSessionUser(context.request);
  if (!user) {
    const location = options.loginUrl ?? '/admin/login';
    return { ok: false, response: new Response(null, { status: 302, headers: { location } }) };
  }
  if (!meetsRequirement(user, requirement)) {
    return {
      ok: false,
      response: new Response('Forbidden', {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      }),
    };
  }
  return { ok: true, user };
}

export function requireOfficer(request: Request): Promise<GuardResult> {
  return guardApi(request, 'officer');
}

export function requireExecutive(request: Request): Promise<GuardResult> {
  return guardApi(request, 'executive');
}

export function requireActiveAccount(request: Request): Promise<GuardResult> {
  return guardApi(request, 'activeAccount');
}

export function requireOfficerPage(
  context: PageContext,
  options?: PageOptions,
): Promise<GuardResult> {
  return guardPage(context, 'officer', options);
}

export function requireExecutivePage(
  context: PageContext,
  options?: PageOptions,
): Promise<GuardResult> {
  return guardPage(context, 'executive', options);
}

export function requireActiveAccountPage(
  context: PageContext,
  options?: PageOptions,
): Promise<GuardResult> {
  return guardPage(context, 'activeAccount', options);
}
```

`src/lib/auth/index.ts`의 마지막 `guard` 재노출 줄을 바꾸고 아래를 더한다.

```ts
export { getSessionUid, getSessionUser, getSessionSecret } from './guard';
export {
  requireActiveAccount,
  requireActiveAccountPage,
  requireExecutive,
  requireExecutivePage,
  requireOfficer,
  requireOfficerPage,
} from './require';
export type { GuardResult } from './require';
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/lib/auth`
Expected: 전부 PASS. 기존 `getSessionUid` 테스트 2개도 그대로 통과해야 한다.

Run: `npm run check`
Expected: 오류 0건.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/auth/guard.ts src/lib/auth/guard.test.ts src/lib/auth/require.ts src/lib/auth/require.test.ts src/lib/auth/index.ts
git commit -m "feat(auth): add getSessionUser and role-aware API and page guards"
```

---

### Task 5: 변경 요청 가드 일반화 (`mutation.ts`)

**Files:**

- Create: `src/lib/auth/mutation.ts`, `src/lib/auth/mutation.test.ts`
- Modify: `src/lib/auth/index.ts`
- Modify: `src/lib/qna/security.ts`, `src/lib/qna/security.test.ts`
- Modify: `src/lib/qna/admin-route.ts`, `src/lib/routes/api-qna-admin-route.test.ts`
- Modify: `src/pages/admin/questions/index.astro`, `src/pages/admin/questions/[id].astro` (CSRF 호출부만)

**Interfaces:**

- Consumes: Task 3의 `meetsRequirement`, `Requirement`, `SessionUser`. Task 4의 `getSessionUser`, `getSessionSecret`.
- Produces (`mutation.ts`):
  - `type CsrfScope = 'qna' | 'forum' | 'users'`
  - `class SecurityError extends Error { code: string; status: number }`
  - `requireSameOrigin(request: Request): void`
  - `createCsrfToken(scope: CsrfScope, sessionToken: string, secret: string): Promise<string>`
  - `verifyCsrfToken(candidate: string, scope: CsrfScope, sessionToken: string, secret: string): Promise<boolean>`
  - `requireMutation(request, options: { scope: CsrfScope; require: Requirement }, dependencies?: { getUser?: (request: Request) => Promise<SessionUser | null>; sessionSecret?: string }): Promise<{ user: SessionUser }>`. 검사 순서는 세션(401 `unauthorized`), 동일 출처, `sec-fetch-site`, CSRF, 역할(403 `forbidden`)이다. 앞의 네 단계는 기존 `requireAdminMutation`과 오류 코드, 순서가 같다.
- `qna/security.ts`는 `QnaSecurityError`(= `SecurityError`의 별칭)와 `requireSameOrigin`을 계속 내보낸다. `requireAdminMutation`, `createCsrfToken`, `verifyCsrfToken`은 `qna/security.ts`에서 사라진다.

- [ ] **Step 1: 테스트를 쓴다**

`src/lib/auth/mutation.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {} }));

import { base64UrlEncode, hmacSha256 } from '../crypto';
import { createCsrfToken, requireMutation, SecurityError, verifyCsrfToken } from './mutation';
import type { SessionUser } from './permissions';

function account(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'admin-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'officer',
    status: 'approved',
    isExecutive: false,
    ...overrides,
  };
}

function mutationRequest(overrides: { origin?: string | null; site?: string; csrf?: string } = {}) {
  const headers = new Headers({
    cookie: 'tcn_session=signed-session',
    origin: overrides.origin === undefined ? 'https://tcn.example' : (overrides.origin ?? ''),
    'sec-fetch-site': overrides.site ?? 'same-origin',
    'x-csrf-token': overrides.csrf ?? '',
  });
  if (overrides.origin === null) headers.delete('origin');
  return new Request('https://tcn.example/api/questions/q-1/answer', { method: 'PUT', headers });
}

const officerOnQna = { scope: 'qna', require: 'officer' } as const;

describe('requireMutation', () => {
  it('accepts a valid session, exact origin, Fetch Metadata and CSRF token', async () => {
    const csrf = await createCsrfToken('qna', 'signed-session', 'secret');
    const user = account();

    await expect(
      requireMutation(mutationRequest({ csrf }), officerOnQna, {
        getUser: vi.fn().mockResolvedValue(user),
        sessionSecret: 'secret',
      }),
    ).resolves.toEqual({ user });
  });

  it.each([
    [{ origin: null }, 'invalid_origin'],
    [{ origin: 'https://evil.example' }, 'invalid_origin'],
    [{ site: 'cross-site' }, 'cross_site_request'],
    [{ csrf: 'forged' }, 'invalid_csrf'],
  ])('rejects mutation header attack %#', async (overrides, code) => {
    const csrf = await createCsrfToken('qna', 'signed-session', 'secret');
    await expect(
      requireMutation(mutationRequest({ csrf, ...overrides }), officerOnQna, {
        getUser: vi.fn().mockResolvedValue(account()),
        sessionSecret: 'secret',
      }),
    ).rejects.toMatchObject({ code, status: 403 });
  });

  it('rejects an invalid session before accepting any mutation metadata', async () => {
    await expect(
      requireMutation(mutationRequest(), officerOnQna, {
        getUser: vi.fn().mockResolvedValue(null),
        sessionSecret: 'secret',
      }),
    ).rejects.toMatchObject({ code: 'unauthorized', status: 401 });
  });

  it.each([
    ['a member', account({ role: 'member' }), officerOnQna],
    ['a pending officer', account({ status: 'pending' }), officerOnQna],
    ['a rejected officer', account({ status: 'rejected' }), officerOnQna],
    ['an officer on an executive route', account(), { scope: 'users', require: 'executive' }],
    [
      'a member carrying the executive flag',
      account({ role: 'member', isExecutive: true }),
      { scope: 'users', require: 'executive' },
    ],
  ] as const)(
    'answers 403 forbidden to %s even with valid headers',
    async (_label, user, options) => {
      const csrf = await createCsrfToken(options.scope, 'signed-session', 'secret');
      await expect(
        requireMutation(mutationRequest({ csrf }), options, {
          getUser: vi.fn().mockResolvedValue(user),
          sessionSecret: 'secret',
        }),
      ).rejects.toMatchObject({ code: 'forbidden', status: 403 });
    },
  );

  it('lets an executive through an executive route and a pending account through an active-account route', async () => {
    const usersCsrf = await createCsrfToken('users', 'signed-session', 'secret');
    const executive = account({ isExecutive: true });
    await expect(
      requireMutation(
        mutationRequest({ csrf: usersCsrf }),
        { scope: 'users', require: 'executive' },
        { getUser: vi.fn().mockResolvedValue(executive), sessionSecret: 'secret' },
      ),
    ).resolves.toEqual({ user: executive });

    const forumCsrf = await createCsrfToken('forum', 'signed-session', 'secret');
    const pending = account({ role: 'member', status: 'pending' });
    await expect(
      requireMutation(
        mutationRequest({ csrf: forumCsrf }),
        { scope: 'forum', require: 'activeAccount' },
        { getUser: vi.fn().mockResolvedValue(pending), sessionSecret: 'secret' },
      ),
    ).resolves.toEqual({ user: pending });
  });

  it('checks origin and CSRF before the role, as the Q&A guard always did', async () => {
    await expect(
      requireMutation(mutationRequest({ csrf: 'forged' }), officerOnQna, {
        getUser: vi.fn().mockResolvedValue(account({ role: 'member' })),
        sessionSecret: 'secret',
      }),
    ).rejects.toMatchObject({ code: 'invalid_csrf', status: 403 });
  });
});

describe('scoped CSRF tokens', () => {
  it('binds a token to its session and verifies in constant time', async () => {
    const token = await createCsrfToken('qna', 'session-a', 'secret');
    await expect(verifyCsrfToken(token, 'qna', 'session-a', 'secret')).resolves.toBe(true);
    await expect(verifyCsrfToken(token, 'qna', 'session-b', 'secret')).resolves.toBe(false);
  });

  it('does not accept a token minted for another scope', async () => {
    const token = await createCsrfToken('qna', 'session-a', 'secret');
    await expect(verifyCsrfToken(token, 'forum', 'session-a', 'secret')).resolves.toBe(false);
    await expect(verifyCsrfToken(token, 'users', 'session-a', 'secret')).resolves.toBe(false);
  });

  it('keeps the legacy Q&A token format so open admin screens survive the deploy', async () => {
    const legacy = base64UrlEncode(await hmacSha256('qna-csrf:signed-session', 'secret'));
    await expect(createCsrfToken('qna', 'signed-session', 'secret')).resolves.toBe(legacy);
    await expect(verifyCsrfToken(legacy, 'qna', 'signed-session', 'secret')).resolves.toBe(true);
  });
});

describe('SecurityError', () => {
  it('carries the code and status the API responds with', () => {
    const error = new SecurityError('forbidden', 403);
    expect(error).toMatchObject({ code: 'forbidden', status: 403, message: 'forbidden' });
  });
});
```

`src/lib/routes/api-qna-admin-route.test.ts`를 다음처럼 고친다.

1. `vi.hoisted`와 구조 분해의 `requireAdminMutation`을 `requireMutation`으로 바꾼다.
2. `vi.mock('../qna/security', ...)` 블록을 다음으로 바꾼다.

```ts
vi.mock('../auth/mutation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/mutation')>()),
  requireMutation,
}));
```

3. `beforeEach`의 `requireAdminMutation.mockResolvedValue({ uid: 'admin-1' })`를 `requireMutation.mockResolvedValue({ user: { id: 'admin-1' } })`로 바꾸고, 파일 안의 나머지 `requireAdminMutation.mockRejectedValue(...)` 두 곳도 `requireMutation`으로 바꾼다.
4. `describe('administrator Q&A mutations', ...)` 안에 테스트 두 개를 더한다.

```ts
it('asks the common guard for an officer on the Q&A scope', async () => {
  await PUT!(context('PUT', { body: 'Answer', expectedRevision: 0 }));
  expect(requireMutation).toHaveBeenCalledWith(expect.any(Request), {
    scope: 'qna',
    require: 'officer',
  });
});

it('answers 403 forbidden to a signed-in account that is not an officer', async () => {
  requireMutation.mockRejectedValue(new QnaSecurityError('forbidden', 403));

  const response = await PATCH!(context('PATCH', { visibility: 'hidden', expectedRevision: 1 }));

  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'forbidden' });
  expect(getDB).not.toHaveBeenCalled();
});
```

`src/lib/qna/security.test.ts`는 파일 위쪽을 다음처럼 정리한다. `adminRequest` 도우미와 앞의 네 테스트(승인, 헤더 공격, 무효 세션, 상수 시간 CSRF)를 지우고(내용은 `mutation.test.ts`로 옮겼다), 남는 `requireSameOrigin` 테스트의 `describe` 이름을 `public write origin guard`로 바꾼다. 가져오는 목록에서 `createCsrfToken`, `requireAdminMutation`, `verifyCsrfToken`을 뺀다. 파일 나머지(속도 제한, Turnstile)는 그대로 둔다.

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {} }));

import {
  consumeQuestionRateLimit,
  getQnaRateLimitKey,
  QnaSecurityError,
  requireSameOrigin,
  verifyTurnstile,
} from './security';
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/auth/mutation.test.ts`
Expected: FAIL. `./mutation`을 찾을 수 없다는 오류.

- [ ] **Step 3: `mutation.ts`를 구현한다**

`src/lib/auth/mutation.ts`:

```ts
import { base64UrlEncode, hmacSha256, textEncoder, timingSafeEqual } from '../crypto';
import { readSessionToken } from './cookie';
import { getSessionSecret, getSessionUser } from './guard';
import { meetsRequirement, type Requirement, type SessionUser } from './permissions';

export type CsrfScope = 'qna' | 'forum' | 'users';

// Q&A 에서 쓰던 오류 클래스를 공용 이름으로 옮겼다. 오류 코드와 상태 코드 문자열은 그대로다.
export class SecurityError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// 접두사는 범위별로 `<scope>-csrf:` 다. qna 는 기존 `qna-csrf:` 와 같아서, 배포 전에 열린 관리
// 화면의 토큰이 배포 때문에 무효가 되지 않는다.
export async function createCsrfToken(
  scope: CsrfScope,
  sessionToken: string,
  secret: string,
): Promise<string> {
  return base64UrlEncode(await hmacSha256(`${scope}-csrf:${sessionToken}`, secret));
}

export async function verifyCsrfToken(
  candidate: string,
  scope: CsrfScope,
  sessionToken: string,
  secret: string,
): Promise<boolean> {
  const expected = textEncoder.encode(await createCsrfToken(scope, sessionToken, secret));
  return timingSafeEqual(expected, textEncoder.encode(candidate));
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new SecurityError('invalid_origin', 403);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new SecurityError('cross_site_request', 403);
  }
}

// 세션, 동일 출처, Fetch Metadata, CSRF 를 차례로 검사한 뒤 역할 조건을 확인한다.
// 앞의 네 단계는 기존 requireAdminMutation 과 순서와 오류 코드가 같다.
export async function requireMutation(
  request: Request,
  options: { scope: CsrfScope; require: Requirement },
  dependencies: {
    getUser?: (request: Request) => Promise<SessionUser | null>;
    sessionSecret?: string;
  } = {},
): Promise<{ user: SessionUser }> {
  const user = await (dependencies.getUser ?? getSessionUser)(request);
  if (!user) throw new SecurityError('unauthorized', 401);

  requireSameOrigin(request);

  const sessionToken = readSessionToken(request);
  if (!sessionToken) throw new SecurityError('unauthorized', 401);
  const csrf = request.headers.get('x-csrf-token') ?? '';
  const secret = dependencies.sessionSecret ?? getSessionSecret();
  if (!csrf || !(await verifyCsrfToken(csrf, options.scope, sessionToken, secret))) {
    throw new SecurityError('invalid_csrf', 403);
  }

  if (!meetsRequirement(user, options.require)) throw new SecurityError('forbidden', 403);
  return { user };
}
```

`src/lib/auth/index.ts`에 추가한다.

```ts
export {
  createCsrfToken,
  requireMutation,
  requireSameOrigin,
  SecurityError,
  verifyCsrfToken,
} from './mutation';
export type { CsrfScope } from './mutation';
```

- [ ] **Step 4: Q&A 쪽을 공용 모듈로 옮긴다**

`src/lib/qna/security.ts`의 맨 위(상수 정의 앞)를 다음으로 바꾼다. 지워지는 것은 기존 `QnaSecurityError` 클래스, `createCsrfToken`, `verifyCsrfToken`, `requireAdminMutation`, `requireSameOrigin`이고, 더 이상 쓰이지 않는 `getSessionSecret`, `getSessionUid`, `readSessionToken`, `textEncoder`, `timingSafeEqual` import도 함께 지운다. `digest`, `getQnaRateLimitKey`, `consumeQuestionRateLimit`, `verifyTurnstile`은 그대로 둔다.

```ts
import { requireSameOrigin, SecurityError as QnaSecurityError } from '../auth/mutation';
import { base64UrlEncode, hmacSha256, sha256 } from '../crypto';

// 공용 보안 오류의 Q&A 이름이다. 같은 클래스라 instanceof 검사와 오류 코드·상태 코드가 그대로 유지된다.
export { QnaSecurityError, requireSameOrigin };

const SHORT_WINDOW_SECONDS = 10 * 60;
const DAY_WINDOW_SECONDS = 24 * 60 * 60;
const SHORT_LIMIT = 3;
const DAY_LIMIT = 20;
const TURNSTILE_TTL_MS = 5 * 60 * 1_000;
```

`src/lib/qna/admin-route.ts`를 고친다.

```ts
import { requireMutation } from '../auth/mutation';
import { QNA_LIMITS, QnaPayloadError, readJsonWithLimit } from './payload';
import { QnaNotFoundError, QnaRevisionConflictError } from './repository';
import { qnaJson } from './response';
import { QnaSecurityError } from './security';
```

그리고 `handleAdminQuestionMutation` 안의 `actorUserId = (await requireAdminMutation(options.request)).uid;`를 다음으로 바꾼다.

```ts
const { user } = await requireMutation(options.request, { scope: 'qna', require: 'officer' });
actorUserId = user.id;
```

두 Q&A 어드민 페이지는 CSRF 호출부만 고친다(가드 교체는 Task 7). `questions/index.astro`와 `questions/[id].astro` 모두 `import { createCsrfToken } from '../../../lib/qna/security';` 줄을 지우고, `'../../../lib/auth'` import 목록에 `createCsrfToken`을 더하고, 호출을 다음으로 바꾼다.

```ts
const csrfToken = await createCsrfToken('qna', sessionToken, getSessionSecret());
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/lib/auth src/lib/qna src/lib/routes`
Expected: 전부 PASS.

Run: `npm run check`
Expected: 오류 0건.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/auth/mutation.ts src/lib/auth/mutation.test.ts src/lib/auth/index.ts src/lib/qna/security.ts src/lib/qna/security.test.ts src/lib/qna/admin-route.ts src/lib/routes/api-qna-admin-route.test.ts "src/pages/admin/questions/index.astro" "src/pages/admin/questions/[id].astro"
git commit -m "refactor(auth): generalize the Q&A mutation guard into requireMutation"
```

---

### Task 6: API 경로의 가드 교체

**Files:**

- Modify: `src/pages/api/posts/index.ts`, `src/pages/api/posts/[id].ts`
- Modify: `src/pages/api/media/index.ts`, `src/pages/api/media/[id].ts`
- Modify: `src/pages/api/maintenance/media-cleanup.ts`
- Modify: `src/lib/routes/api-posts-route.test.ts`, `api-media-route.test.ts`, `api-media-upload-route.test.ts`, `api-media-cleanup-route.test.ts`

**Interfaces:**

- Consumes: Task 4의 `requireOfficer`, `GuardResult`.
- Produces: 다섯 경로가 승인된 임원만 통과시킨다. 비로그인 응답(401 `unauthorized`)의 본문과 상태는 기존과 같고, 임원이 아닌 계정은 403 `forbidden`을 받는다.

이 네 테스트 파일은 지금 `'../auth'`를 통째로 모킹한다. 가드를 모킹하면 임원 판정 자체를 검증하지 못하므로, 아래처럼 세션 조회(`'../auth/guard'`)만 모킹해 진짜 `requireOfficer`가 돌게 한다.

- [ ] **Step 1: 테스트를 먼저 고친다**

네 파일에 공통으로 적용한다.

1. `vi.hoisted` 안의 `getSessionUid: vi.fn(),`를 `getSessionUser: vi.fn(),`로 바꾸고, 구조 분해의 `getSessionUid`도 `getSessionUser`로 바꾼다.
2. `vi.mock('../auth', () => ({ getSessionUid }));`를 다음으로 바꾼다.

```ts
vi.mock('../auth/guard', () => ({
  getSessionUid: vi.fn(),
  getSessionSecret: vi.fn(),
  getSessionUser,
}));
```

3. import 블록 아래에 계정 픽스처를 더한다. `id`는 파일마다 기존 값(`posts` 테스트는 `'editor-1'`, 나머지는 `'user-1'`)을 쓴다.

```ts
const OFFICER = {
  id: 'user-1',
  username: 'editor',
  displayName: 'Editor',
  role: 'officer',
  status: 'approved',
  isExecutive: false,
} as const;
const MEMBER = { ...OFFICER, id: 'member-1', role: 'member' } as const;
```

4. `getSessionUid.mockResolvedValue('<id>')` 줄은 모두 `getSessionUser.mockResolvedValue(OFFICER)`로, `getSessionUid.mockResolvedValue(null)`은 `getSessionUser.mockResolvedValue(null)`로 바꾼다.

각 파일에 아래 테스트를 더한다. `beforeEach`가 `OFFICER`를 넣으므로 테스트 안에서 덮어쓴다.

`api-posts-route.test.ts`의 `describe('POST /api/posts')` 안:

```ts
it('rejects a signed-in account that is not an officer before parsing or opening D1', async () => {
  getSessionUser.mockResolvedValue(MEMBER);

  const response = await POST!(createContext());

  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual({ ok: false, error: 'forbidden' });
  expect(getDB).not.toHaveBeenCalled();
  expect(createPost).not.toHaveBeenCalled();
});
```

같은 파일의 `describe('PUT /api/posts/[id]')` 안과 `describe('DELETE /api/posts/[id]')` 안에 각각:

```ts
it('answers 401 without a session and 403 to a non-officer before any read', async () => {
  getSessionUser.mockResolvedValue(null);
  expect((await PUT!(itemContext('PUT'))).status).toBe(401);

  getSessionUser.mockResolvedValue(MEMBER);
  const response = await PUT!(itemContext('PUT'));
  expect(response.status).toBe(403);
  expect(getPost).not.toHaveBeenCalled();
  expect(updatePost).not.toHaveBeenCalled();
});
```

`DELETE` 쪽은 `PUT`을 `DELETE`로, `getPost`/`updatePost`를 `softDeletePost`로 바꾼 같은 형태로 쓴다(`expect(softDeletePost).not.toHaveBeenCalled();`).

`api-media-route.test.ts`의 `describe('PATCH /api/media/[id]')` 안과 `describe('DELETE /api/media/[id]')` 안에 각각:

```ts
it('answers 401 without a session and 403 to a non-officer before touching D1 or R2', async () => {
  getSessionUser.mockResolvedValue(null);
  expect((await mediaRoute.PATCH!(context({ caption: 'x' }))).status).toBe(401);

  getSessionUser.mockResolvedValue(MEMBER);
  const response = await mediaRoute.PATCH!(context({ caption: 'x' }));
  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual({ ok: false, error: 'forbidden' });
  expect(updateMediaMetadata).not.toHaveBeenCalled();
});
```

`DELETE` 쪽은 `mediaRoute.DELETE!(deleteContext())`를 쓰고 마지막 단정을 `expect(deleteMediaAndQueueCleanup).not.toHaveBeenCalled(); expect(bucket.delete).not.toHaveBeenCalled();`로 바꾼다.

`api-media-upload-route.test.ts`의 `describe('POST /api/media')` 안:

```ts
it('answers 401 without a session and 403 to a non-officer before reading the body', async () => {
  getSessionUser.mockResolvedValue(null);
  expect((await POST!(context())).status).toBe(401);

  getSessionUser.mockResolvedValue(MEMBER);
  const response = await POST!(context());
  expect(response.status).toBe(403);
  expect(getPost).not.toHaveBeenCalled();
  expect(bucket.put).not.toHaveBeenCalled();
});
```

`api-media-cleanup-route.test.ts`의 `describe('POST /api/maintenance/media-cleanup')` 안:

```ts
it('answers 401 without a session and 403 to a non-officer before listing cleanup keys', async () => {
  const request = () =>
    ({
      request: new Request('http://localhost/api/maintenance/media-cleanup', { method: 'POST' }),
    }) as never;

  getSessionUser.mockResolvedValue(null);
  expect((await POST!(request())).status).toBe(401);

  getSessionUser.mockResolvedValue(MEMBER);
  expect((await POST!(request())).status).toBe(403);
  expect(listMediaCleanupKeys).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/routes/api-posts-route.test.ts src/lib/routes/api-media-route.test.ts src/lib/routes/api-media-upload-route.test.ts src/lib/routes/api-media-cleanup-route.test.ts`
Expected: FAIL. 라우트가 아직 `getSessionUid`를 부르므로 `getSessionUser` 모킹이 무시되고, 403 테스트가 `200`을 받는다.

- [ ] **Step 3: 다섯 라우트를 교체한다**

모든 파일에서 `import { getSessionUid } from '../../../lib/auth';`를 `import { requireOfficer } from '../../../lib/auth';`로 바꾼다. 가드 호출은 다음 형태로 바꾼다.

```ts
const guard = await requireOfficer(request);
if (!guard.ok) return guard.response;
```

파일별 변경은 다음과 같다.

- `posts/index.ts`의 `POST`: 기존 두 줄(`const uid = ...`, `if (!uid) return ...401`)을 위 형태로 바꾸고, `createPost`의 `authorId: uid`를 `authorId: guard.user.id`로 바꾼다. 위쪽 주석 `// 글 생성: 인증 필요. 권한 없음(인증된 누구나) — 설계상 flat.`은 `// 글 생성: 승인된 임원만. 세션만 확인하고 CSRF 는 요구하지 않는다(기존 동작 유지).`로 바꾼다.
- `posts/[id].ts`의 `PUT`과 `DELETE`: 두 곳 모두 위 형태로 바꾼다(`uid`는 이 파일에서 더 쓰이지 않는다). `PUT` 위의 주석 `// 글 수정(전체 저장). 인증 필요, 권한 없음(flat).`은 `// 글 수정(전체 저장). 승인된 임원만.`으로 바꾼다.
- `media/index.ts`의 `POST`, `media/[id].ts`의 `PATCH`와 `DELETE`: 위 형태로 바꾼다.
- `maintenance/media-cleanup.ts`의 `POST`: 기존 `if (!(await getSessionUid(request))) { return ...401 }` 블록을 위 형태로 바꾼다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/routes`
Expected: 전부 PASS. 기존 테스트(권한 외 동작)가 그대로 통과해야 한다.

Run: `npm run check`
Expected: 오류 0건.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/api/posts src/pages/api/media src/pages/api/maintenance/media-cleanup.ts src/lib/routes/api-posts-route.test.ts src/lib/routes/api-media-route.test.ts src/lib/routes/api-media-upload-route.test.ts src/lib/routes/api-media-cleanup-route.test.ts
git commit -m "feat(auth): require an approved officer on seminar, media and cleanup APIs"
```

---

### Task 7: 어드민 페이지의 가드 교체

**Files:**

- Modify: `src/pages/admin/index.astro`, `src/pages/admin/posts/new.astro`, `src/pages/admin/posts/[id].astro`
- Modify: `src/pages/admin/questions/index.astro`, `src/pages/admin/questions/[id].astro`

**Interfaces:**

- Consumes: Task 4의 `requireOfficerPage`. Task 5에서 두 Q&A 페이지의 `createCsrfToken` 호출부를 이미 바꿨다.
- Produces: 다섯 페이지가 승인된 임원만 렌더링한다. 비로그인 방문자는 기존과 같은 주소로 이동한다(`index`, `posts/*`는 `/admin/login`, Q&A 두 페이지는 `returnTo`가 붙은 로그인 주소).

페이지는 단위 테스트가 없으므로 Task 8의 커버리지 테스트(가드 호출 존재)와 `npm run build`, CI의 `verify:admin`(브라우저 게이트)이 검증한다.

- [ ] **Step 1: `admin/index.astro`**

frontmatter를 다음으로 바꾼다(`dateFormatter`부터는 그대로).

```text
---
export const prerender = false;
import AdminLayout from '../../layouts/AdminLayout.astro';
import { requireOfficerPage } from '../../lib/auth';
import { getDB, listPosts } from '../../lib/db';

const guard = await requireOfficerPage(Astro);
if (!guard.ok) return guard.response;
const { user } = guard;

const posts = await listPosts(getDB());
const dateFormatter = new Intl.DateTimeFormat('en-US', {
```

기존의 `getSessionUid`, `getUserById`, `Promise.all`, `if (!user) return Astro.redirect('/admin/login');`은 모두 지운다.

- [ ] **Step 2: `admin/posts/new.astro`**

```text
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import PostEditor from '../../../components/admin/PostEditor';
import { requireOfficerPage } from '../../../lib/auth';
import { getDB } from '../../../lib/db';
import { getSeminarCollection } from '../../../lib/seminars/service';

const guard = await requireOfficerPage(Astro);
if (!guard.ok) return guard.response;
const { user } = guard;

const seminars = await getSeminarCollection(getDB());
const seminarSequence = seminars.chronological.length + 1;
---
```

- [ ] **Step 3: `admin/posts/[id].astro`**

frontmatter 앞부분(`const editorPost` 앞까지)을 다음으로 바꾼다.

```text
---
export const prerender = false;
import AdminLayout from '../../../layouts/AdminLayout.astro';
import PostEditor from '../../../components/admin/PostEditor';
import { requireOfficerPage } from '../../../lib/auth';
import { getDB, getPost, listMediaForPost } from '../../../lib/db';
import { getSeminarCollection } from '../../../lib/seminars/service';

const guard = await requireOfficerPage(Astro);
if (!guard.ok) return guard.response;
const { user } = guard;

const db = getDB();
const id = Astro.params.id!;
const [post, seminars] = await Promise.all([getPost(db, id), getSeminarCollection(db)]);
if (!post) return Astro.redirect('/admin');
const media = await listMediaForPost(db, id);
```

이후 `seminarSequence`, `editorPost`, `editorMedia`는 그대로 둔다.

- [ ] **Step 4: `admin/questions/index.astro`**

import와 가드 부분을 고친다. Task 5에서 `createCsrfToken`을 이미 `'../../../lib/auth'` import에 더했으므로 `getSessionUid`와 `getUserById`만 정리한다.

```ts
import {
  createCsrfToken,
  getSessionSecret,
  readSessionToken,
  requireOfficerPage,
} from '../../../lib/auth';
import { getDB } from '../../../lib/db';
```

가드 구간(`const uid = ...`부터 `if (!sessionToken) ...`까지)을 다음으로 바꾼다.

```ts
const currentPath = `${Astro.url.pathname}${Astro.url.search}`;
const loginUrl = `/admin/login?returnTo=${encodeURIComponent(currentPath)}`;
const guard = await requireOfficerPage(Astro, { loginUrl });
if (!guard.ok) return guard.response;
const { user } = guard;

const sessionToken = readSessionToken(Astro.request);
if (!sessionToken) return Astro.redirect(loginUrl);
```

그리고 D1 조회 구간을 다음으로 바꾼다(`user` 조회와 `if (!user) ...` 줄을 지운다).

```ts
const db = getDB();
const [waitingFirst, answeredFirst, hiddenFirst] = await Promise.all([
  listAdminQuestions(db, { status: 'waiting', page: 1 }),
  listAdminQuestions(db, { status: 'answered', page: 1 }),
  listAdminQuestions(db, { status: 'hidden', page: 1 }),
]);
```

- [ ] **Step 5: `admin/questions/[id].astro`**

```ts
import AdminLayout from '../../../layouts/AdminLayout.astro';
import {
  createCsrfToken,
  getSessionSecret,
  readSessionToken,
  requireOfficerPage,
} from '../../../lib/auth';
import { getDB } from '../../../lib/db';
import { getAdminQuestion } from '../../../lib/qna/repository';
```

가드 구간을 다음으로 바꾼다.

```ts
const id = Astro.params.id ?? '';
const returnPath = `/admin/questions/${encodeURIComponent(id)}`;
const loginUrl = `/admin/login?returnTo=${encodeURIComponent(returnPath)}`;
const guard = await requireOfficerPage(Astro, { loginUrl });
if (!guard.ok) return guard.response;
const { user } = guard;

const sessionToken = readSessionToken(Astro.request);
if (!sessionToken) return Astro.redirect(loginUrl);

const question = await getAdminQuestion(getDB(), id);
if (!question) Astro.response.status = 404;
```

이 파일의 나머지에서 `db` 변수를 참조하는 곳이 있으면 `const db = getDB();`를 되살린다. 확인은 `grep -n "\bdb\b" "src/pages/admin/questions/[id].astro"`로 한다.

- [ ] **Step 6: 확인**

Run: `grep -rn "getSessionUid\|getUserById" src/pages/admin`
Expected: `admin/login.astro`의 `getSessionUid`만 남는다(공개 경로이므로 그대로 둔다).

Run: `npm run check`
Expected: 오류 0건.

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
git add src/pages/admin/index.astro src/pages/admin/posts src/pages/admin/questions
git commit -m "feat(auth): require an approved officer on admin pages"
```

---

### Task 8: `/api/auth/me` 응답 확장과 가드 커버리지 테스트

**Files:**

- Modify: `src/pages/api/auth/me.ts`, `src/lib/routes/api-auth-session-routes.test.ts`
- Create: `src/lib/auth/route-guard-coverage.test.ts`

**Interfaces:**

- Consumes: Task 4의 `getSessionUser`. Task 5의 `handleAdminQuestionMutation`이 `requireMutation`을 부른다는 사실.
- Produces: `/api/auth/me`의 `user`가 `{ id, username, displayName, role, status }`다(결정권 값은 노출하지 않는다). 새 경로가 가드를 빠뜨리면 실패하는 테스트가 생긴다.

- [ ] **Step 1: `me` 테스트를 고친다**

`src/lib/routes/api-auth-session-routes.test.ts`에서 `vi.hoisted`에 `getSessionUser: vi.fn(),`을 더하고(구조 분해에도 추가), 모킹을 다음으로 바꾼다. `getUserById`는 `me`가 더 쓰지 않으므로 `'../db'` 모킹과 구조 분해에서 뺀다.

```ts
vi.mock('../auth', () => ({ clearSessionCookie, getSessionUid, getSessionUser }));
vi.mock('../db', () => ({ getDB, revokeUserSessions }));
```

`describe('GET /api/auth/me')` 전체를 다음으로 바꾼다.

```ts
describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({
      id: 'user-1',
      username: 'editor',
      displayName: 'TCN Editor',
      role: 'officer',
      status: 'approved',
      isExecutive: true,
    });
  });

  it('returns the identity fields plus role and status, never the executive flag', async () => {
    const response = await me!(context('/api/auth/me'));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      authenticated: true,
      user: {
        id: 'user-1',
        username: 'editor',
        displayName: 'TCN Editor',
        role: 'officer',
        status: 'approved',
      },
    });
  });

  it('reports pending and rejected accounts as authenticated with their status', async () => {
    getSessionUser.mockResolvedValue({
      id: 'user-2',
      username: 'new@example.org',
      displayName: null,
      role: 'member',
      status: 'pending',
      isExecutive: false,
    });

    const body = await (await me!(context('/api/auth/me'))).json();

    expect(body).toMatchObject({
      authenticated: true,
      user: { role: 'member', status: 'pending' },
    });
  });

  it('treats a missing session or deleted user as unauthenticated', async () => {
    getSessionUser.mockResolvedValue(null);

    await expect((await me!(context('/api/auth/me'))).json()).resolves.toEqual({
      ok: true,
      authenticated: false,
    });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/routes/api-auth-session-routes.test.ts`
Expected: FAIL. 기존 `me`는 `getSessionUid`와 `getUserById`를 쓰므로 응답에 `role`, `status`가 없다.

- [ ] **Step 3: `me.ts`를 구현한다**

```ts
import type { APIRoute } from 'astro';
import { getSessionUser } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ ok: true, authenticated: false });

  return Response.json({
    ok: true,
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  });
};
```

Run: `npx vitest run src/lib/routes/api-auth-session-routes.test.ts`
Expected: PASS. 로그아웃 테스트도 그대로 통과한다.

- [ ] **Step 4: 커버리지 테스트를 쓴다**

`src/lib/auth/route-guard-coverage.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 경로 파일이 공용 가드를 부르는지 확인한다. 호출 문자열의 존재만 보므로 가드를 올바르게 썼다는
// 증명은 아니다. 올바른 사용은 가드 단위 테스트와 라우트 테스트가 맡는다.
const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const PAGES_DIR = join(SRC_DIR, 'pages');
const GUARDED_DIRS = ['admin', 'api', 'forum'];

// handleAdminQuestionMutation 은 requireMutation 을 대신 부르는 래퍼다(아래 마지막 테스트가 확인한다).
const GUARD_CALL =
  /\b(?:requireOfficer|requireOfficerPage|requireExecutive|requireExecutivePage|requireActiveAccount|requireActiveAccountPage|requireMutation|handleAdminQuestionMutation)\s*\(/;

// 가드가 없어도 되는 경로. 현재 존재하는 경로만 올린다(없는 항목은 테스트가 실패한다).
const PUBLIC_ROUTES: Record<string, string> = {
  'admin/login.astro': '로그인 화면은 세션 없이 열려야 한다.',
  'api/auth/login.ts': '자격 증명을 확인하는 경로이며 속도 제한이 걸려 있다.',
  'api/auth/logout.ts': '호출자 본인의 세션만 폐기한다.',
  'api/auth/me.ts': '호출자 본인의 상태만 알려 주고 비로그인에는 authenticated: false 를 준다.',
  'api/health.ts': '생존 확인용이고 외부 자원을 검사하지 않는다.',
  'api/ready.ts': '준비 상태 확인용이고 바인딩 유무만 알린다.',
  'api/questions/index.ts': '익명 질문은 공개 기능이며 Turnstile과 속도 제한으로 보호한다.',
};

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

function listRouteFiles(): string[] {
  return GUARDED_DIRS.flatMap((dir) => {
    const root = join(PAGES_DIR, dir);
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true, encoding: 'utf8' })
      .map((file) => file.replaceAll('\\', '/'))
      .filter((file) => /\.(?:astro|ts)$/.test(file) && !file.endsWith('.test.ts'))
      .map((file) => `${dir}/${file}`);
  });
}

describe('route guard coverage', () => {
  const files = listRouteFiles();

  it('finds the route files it is supposed to check', () => {
    expect(files).toEqual(
      expect.arrayContaining(['admin/index.astro', 'api/posts/index.ts', 'api/media/[id].ts']),
    );
  });

  it.each(files.filter((file) => !(file in PUBLIC_ROUTES)))('%s calls a shared guard', (file) => {
    const source = stripComments(readFileSync(join(PAGES_DIR, file), 'utf8'));
    expect(source, `${file} must call a guard or be listed in PUBLIC_ROUTES with a reason`).toMatch(
      GUARD_CALL,
    );
  });

  it.each(Object.keys(PUBLIC_ROUTES))('public route %s still exists', (file) => {
    expect(files, `${file} is listed as public but the file is gone`).toContain(file);
  });

  it('keeps the Q&A mutation wrapper behind the officer guard', () => {
    const source = stripComments(readFileSync(join(SRC_DIR, 'lib/qna/admin-route.ts'), 'utf8'));
    expect(source).toMatch(
      /requireMutation\(\s*options\.request,\s*\{\s*scope:\s*'qna',\s*require:\s*'officer'/,
    );
  });
});
```

- [ ] **Step 5: 통과를 확인하고, 테스트가 실제로 가드 누락을 잡는지 확인한다**

Run: `npx vitest run src/lib/auth/route-guard-coverage.test.ts`
Expected: 전부 PASS. 이 시점에는 Task 5~8로 모든 경로가 가드를 부르거나 공개 목록에 있다.

변이 확인 하나를 한다. `src/pages/admin/posts/new.astro`의 `requireOfficerPage(Astro)` 호출 줄을 임시로 `// ` 주석 처리하고 같은 명령을 다시 실행한다.
Expected: `admin/posts/new.astro calls a shared guard`가 FAIL하고 파일 이름이 메시지에 나온다. 확인 후 `git checkout -- src/pages/admin/posts/new.astro`로 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add src/pages/api/auth/me.ts src/lib/routes/api-auth-session-routes.test.ts src/lib/auth/route-guard-coverage.test.ts
git commit -m "feat(auth): report role and status from /api/auth/me and test route guard coverage"
```

---

### Task 9: 운영자 스크립트 (`create-user.mjs`, `set-user-role.mjs`)

**Files:**

- Create: `src/lib/auth/user-scripts.test.ts`
- Modify: `scripts/create-user.mjs`
- Create: `scripts/set-user-role.mjs`
- Modify: `scripts/verify-admin-authoring.mjs` (45행)

**Interfaces:**

- Consumes: Task 1의 컬럼.
- Produces: `create-user.mjs <username> <password> --role officer|member [--executive] [--remote] [--display "Name"] [--dry-run]`, `set-user-role.mjs <username> --role officer|member [--executive] [--remote] [--dry-run]`. `--dry-run`은 SQL을 stdout에 출력하고 wrangler를 부르지 않은 채 종료 코드 0으로 끝난다. 오류는 stderr 메시지와 종료 코드 1이다.

테스트는 스크립트를 자식 프로세스로 실행한다(`.mjs`를 TypeScript에서 import하면 `astro check`가 타입 오류를 낸다). `password-script-parity.test.ts`가 읽는 줄은 건드리지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/auth/user-scripts.test.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function run(script: string, args: string[]) {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('create-user.mjs', () => {
  it('refuses to run without --role and prints no SQL', () => {
    const result = run('create-user.mjs', ['a@example.org', 'password-1234', '--dry-run']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--role');
    expect(result.stdout).not.toContain('insert into');
  });

  it.each([
    [['--role', 'admin'], '--role'],
    [['--role', 'member', '--executive'], '--executive'],
  ])('rejects %j', (flags, mentioned) => {
    const result = run('create-user.mjs', [
      'a@example.org',
      'password-1234',
      ...flags,
      '--dry-run',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(mentioned);
    expect(result.stdout).not.toContain('insert into');
  });

  it.each([
    [['--role', 'member'], "'member', 'approved', 0"],
    [['--role', 'officer'], "'officer', 'approved', 0"],
    [['--role', 'officer', '--executive'], "'officer', 'approved', 1"],
  ])('inserts an approved account for %j', (flags, values) => {
    const result = run('create-user.mjs', [
      'a@example.org',
      'password-1234',
      ...flags,
      '--dry-run',
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('insert into users');
    expect(result.stdout).toContain(values);
  });

  it('never prints the password or its hash in a dry run', () => {
    const result = run('create-user.mjs', [
      'a@example.org',
      'password-1234',
      '--role',
      'member',
      '--dry-run',
    ]);
    expect(result.stdout).not.toContain('password-1234');
    expect(result.stdout).not.toContain('pbkdf2$');
  });

  it('escapes single quotes in the display name', () => {
    const result = run('create-user.mjs', [
      'a@example.org',
      'password-1234',
      '--role',
      'member',
      '--display',
      "O'Neil",
      '--dry-run',
    ]);
    expect(result.stdout).toContain("'O''Neil'");
  });
});

describe('set-user-role.mjs', () => {
  it('refuses to run without --role', () => {
    const result = run('set-user-role.mjs', ['someone', '--dry-run']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--role');
    expect(result.stdout).not.toContain('update users');
  });

  it('refuses --executive for a member', () => {
    const result = run('set-user-role.mjs', [
      'someone',
      '--role',
      'member',
      '--executive',
      '--dry-run',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--executive');
    expect(result.stdout).not.toContain('update users');
  });

  it('turns the executive flag off unless --executive is given, and only touches approved officers', () => {
    const officer = run('set-user-role.mjs', ['someone', '--role', 'officer', '--dry-run']);
    expect(officer.status).toBe(0);
    expect(officer.stdout).toContain(
      "update users set role = 'officer', is_executive = 0 where username = 'someone' and status = 'approved';",
    );

    const executive = run('set-user-role.mjs', [
      'someone',
      '--role',
      'officer',
      '--executive',
      '--dry-run',
    ]);
    expect(executive.stdout).toContain(
      "is_executive = 1 where username = 'someone' and status = 'approved'",
    );
  });

  it('demotes to member and clears the executive flag without an approval condition', () => {
    const result = run('set-user-role.mjs', ['someone', '--role', 'member', '--dry-run']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "update users set role = 'member', is_executive = 0 where username = 'someone';",
    );
  });

  it('re-reads the account after the update so a missed row is never reported as success', () => {
    const result = run('set-user-role.mjs', ['someone', '--role', 'officer', '--dry-run']);
    expect(result.stdout).toContain(
      "select role, status, is_executive from users where username = 'someone';",
    );
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/auth/user-scripts.test.ts`
Expected: FAIL. `create-user.mjs`는 `--role`을 모르고 `set-user-role.mjs`는 존재하지 않는다.

- [ ] **Step 3: `create-user.mjs`를 고친다**

`hashPassword`와 그 위의 `WRANGLER`, `ITERATIONS`, `textEncoder`, `toBase64`는 건드리지 않는다. 바꾸는 곳은 파일 맨 위 주석과 `parseArgs` 아래 전부다.

맨 위 주석(1~10행)을 다음으로 바꾼다.

```js
#!/usr/bin/env node
// 계정 수동 발급. 회원가입 UI 없음. 운영자가 아이디/평문비번/역할을 주면 해시해서 D1 에 INSERT.
//
// 사용법:
//   node scripts/create-user.mjs <username> <password> --role officer|member
//     [--executive] [--remote] [--display "표시이름"] [--dry-run]
//
//   --role       필수. 의도하지 않은 권한 부여를 막으려고 기본값이 없다.
//   --executive  결정권(회장·부회장). --role officer 와 함께일 때만 허용한다.
//   --remote     원격(운영) D1 에 생성. 없으면 로컬(.wrangler) D1.
//   --display    표시 이름(선택).
//   --dry-run    실행하지 않고 SQL 만 출력한다(비밀번호와 해시는 출력하지 않는다).
//
// 발급된 계정은 status 가 approved 다. 해싱은 src/lib/auth/password.ts 와 동일 알고리즘·포맷
// (pbkdf2$iter$salt$hash)이라 로그인 검증과 호환된다.
```

`parseArgs`부터 파일 끝까지를 다음으로 바꾼다.

```js
const USAGE =
  'usage: node scripts/create-user.mjs <username> <password> --role officer|member ' +
  '[--executive] [--remote] [--display "Name"] [--dry-run]';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const parsed = { remote: false, dryRun: false, executive: false, displayName: null, role: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--remote') parsed.remote = true;
    else if (argv[i] === '--dry-run') parsed.dryRun = true;
    else if (argv[i] === '--executive') parsed.executive = true;
    else if (argv[i] === '--display') parsed.displayName = argv[(i += 1)] ?? null;
    else if (argv[i] === '--role') parsed.role = argv[(i += 1)] ?? null;
    else positional.push(argv[i]);
  }
  return { username: positional[0], password: positional[1], ...parsed };
}

const { username, password, remote, dryRun, executive, displayName, role } = parseArgs(
  process.argv.slice(2),
);
if (!username || !password) fail(USAGE);
if (role !== 'officer' && role !== 'member') fail(`--role officer|member is required\n${USAGE}`);
if (executive && role !== 'officer') fail('--executive is only allowed with --role officer');

const id = crypto.randomUUID();
const passwordHash = dryRun ? '<password-hash>' : await hashPassword(password);
const sqlLiteral = (value) => (value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const sql =
  `insert into users (id, username, password_hash, display_name, role, status, is_executive) values ` +
  `(${sqlLiteral(id)}, ${sqlLiteral(username)}, ${sqlLiteral(passwordHash)}, ${sqlLiteral(displayName)}, ` +
  `${sqlLiteral(role)}, 'approved', ${executive ? 1 : 0});`;

if (dryRun) {
  console.log(sql);
  process.exit(0);
}

const target = remote ? '--remote' : '--local';
try {
  execFileSync(WRANGLER, ['d1', 'execute', 'tcn-content', target, '--command', sql], {
    stdio: 'inherit',
  });
  console.log(
    `\n✅ user '${username}' created as ${role}${executive ? ' (executive)' : ''} on ` +
      `${remote ? 'remote' : 'local'} D1 (id=${id})`,
  );
} catch {
  console.error(`\n❌ failed to create '${username}' (아이디 중복이면 UNIQUE 제약 위반)`);
  process.exit(1);
}
```

`dryRun`에서 `hashPassword`를 건너뛰므로 SQL에는 자리 표시자만 들어가고, 해시와 비밀번호가 출력되지 않는다.

- [ ] **Step 4: `set-user-role.mjs`를 만든다**

`scripts/set-user-role.mjs`:

```js
#!/usr/bin/env node
// 계정의 역할과 결정권(회장·부회장) 변경. 화면에서는 임원 역할과 결정권을 줄 수 없으므로
// (명세서 4.3) 운영자가 이 스크립트로만 바꾼다.
//
// 사용법:
//   node scripts/set-user-role.mjs <username> --role officer|member [--executive] [--remote] [--dry-run]
//
//   --role       필수. 결과 상태가 인자로 완전히 정해진다. 생략한 값을 현재 값으로 두지 않는다.
//   --executive  결정권. --role officer 와 함께일 때만 허용한다. 생략하면 결정권이 꺼진다.
//   --remote     원격(운영) D1. 없으면 로컬(.wrangler) D1.
//   --dry-run    실행하지 않고 SQL 만 출력한다. 운영 DB 에 쓰기 전에 먼저 확인한다.
//
// officer 는 status 가 approved 인 계정에만 줄 수 있다(임원 권한은 승인된 계정에서만 유효, 명세서 4.1).
// 실행 뒤 같은 계정을 다시 읽어 기대한 값이 되었는지 확인한다. 계정이 없거나 승인되지 않았으면
// 오류로 끝난다. 역할은 요청마다 D1 에서 읽으므로 세션을 폐기할 필요가 없다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// PATH 조회를 거치지 않도록 저장소 안의 실행 파일을 직접 가리킨다(create-user.mjs 와 같은 이유).
const WRANGLER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  '.bin',
  'wrangler',
);

const USAGE =
  'usage: node scripts/set-user-role.mjs <username> --role officer|member [--executive] [--remote] [--dry-run]';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const parsed = { remote: false, dryRun: false, executive: false, role: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--remote') parsed.remote = true;
    else if (argv[i] === '--dry-run') parsed.dryRun = true;
    else if (argv[i] === '--executive') parsed.executive = true;
    else if (argv[i] === '--role') parsed.role = argv[(i += 1)] ?? null;
    else positional.push(argv[i]);
  }
  return { username: positional[0], ...parsed };
}

const { username, role, executive, remote, dryRun } = parseArgs(process.argv.slice(2));
if (!username) fail(USAGE);
if (role !== 'officer' && role !== 'member') fail(`--role officer|member is required\n${USAGE}`);
if (executive && role !== 'officer') fail('--executive is only allowed with --role officer');

const sqlLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;
const isExecutive = executive ? 1 : 0;
const approvedOnly = role === 'officer' ? " and status = 'approved'" : '';
const update =
  `update users set role = ${sqlLiteral(role)}, is_executive = ${isExecutive} ` +
  `where username = ${sqlLiteral(username)}${approvedOnly};`;
const verify = `select role, status, is_executive from users where username = ${sqlLiteral(username)};`;
const sql = `${update} ${verify}`;

if (dryRun) {
  console.log(sql);
  process.exit(0);
}

const target = remote ? '--remote' : '--local';
let row;
try {
  const output = execFileSync(
    WRANGLER,
    ['d1', 'execute', 'tcn-content', target, '--command', sql, '--json'],
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] },
  );
  row = JSON.parse(output).at(-1)?.results?.[0];
} catch {
  fail(
    `❌ could not confirm the update for '${username}'. The change may or may not have applied; ` +
      `check with: select role, status, is_executive from users where username = '${username}'`,
  );
}

if (!row) fail(`❌ user '${username}' not found`);
const applied =
  row.role === role &&
  row.is_executive === isExecutive &&
  (role === 'member' || row.status === 'approved');
if (!applied) {
  fail(
    `❌ '${username}' was not updated (role=${row.role}, status=${row.status}, executive=${row.is_executive}). ` +
      'An officer role needs an approved account.',
  );
}
console.log(
  `✅ ${username}: role=${row.role} status=${row.status} executive=${row.is_executive} ` +
    `on ${remote ? 'remote' : 'local'} D1`,
);
```

- [ ] **Step 5: CI 브라우저 게이트의 계정 발급 호출을 고친다**

`scripts/verify-admin-authoring.mjs` 45행을 다음으로 바꾼다.

```js
execFileSync(process.execPath, ['scripts/create-user.mjs', USERNAME, PASSWORD, '--role', 'officer'], {
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/lib/auth/user-scripts.test.ts src/lib/auth/password-script-parity.test.ts`
Expected: 전부 PASS. `password-script-parity.test.ts`가 통과해야 `hashPassword`를 건드리지 않았다는 뜻이다.

로컬 D1로 한 번 직접 확인한다. 이 명령은 개발용 로컬 DB(`.wrangler`)를 쓰고, 임시 계정은 끝에서 지운다.

```bash
./node_modules/.bin/wrangler d1 migrations apply tcn-content --local
node scripts/create-user.mjs plan-smoke smoke-password-1 --role member
node scripts/set-user-role.mjs plan-smoke --role officer     # 승인된 계정이라 성공해야 한다
node scripts/set-user-role.mjs plan-smoke --role officer --executive
node scripts/set-user-role.mjs no-such-user --role officer    # 종료 코드 1, "not found"
./node_modules/.bin/wrangler d1 execute tcn-content --local --command "delete from users where username = 'plan-smoke'"
```

Expected: 처음 세 명령은 `✅`로 끝나고, 네 번째는 `❌ user 'no-such-user' not found`와 종료 코드 1이다. 승인되지 않은 계정 거부는 `update ... and status = 'approved'` 조건과 `select` 검증에 의존하며, 로컬에서 `pending` 행을 직접 만들어 확인해도 된다.

- [ ] **Step 7: 커밋**

```bash
git add scripts/create-user.mjs scripts/set-user-role.mjs scripts/verify-admin-authoring.mjs src/lib/auth/user-scripts.test.ts
git commit -m "feat(scripts): require a role when creating users and add set-user-role"
```

---

### Task 10: 운영 문서와 최종 검증

**Files:**

- Modify: `docs/operations-runbook.md`
- Modify: `README.md`, `CONTENT_ARCHITECTURE.md` (명령 예시 한 줄씩, "명세서와 다르게 정한 점" 4번)
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: Task 9의 스크립트 사용법.
- Produces: 운영 절차 문서와 변경 이력. 코드 변경은 없다.

- [ ] **Step 1: 운영 런북에 절을 추가한다**

`docs/operations-runbook.md`의 `## Readiness triage` 절 바로 앞에 다음 절을 넣는다. 런북은 영어 문서이므로 영어로 쓴다.

````markdown
## Account roles and executive authority

An account has a role (`officer` or `member`), a status (`pending`, `approved`, `rejected`) and an executive flag (`is_executive`, for the president and vice presidents). The admin screens and the seminar, media and Q&A answer APIs require an approved officer. Deciding sign-ups and hiding other people's forum posts (later phases) require an approved officer with the executive flag. The site reads all three values from D1 on every request, so a change takes effect immediately and no session has to be revoked.

Nothing in the product grants the officer role or the executive flag. Use the scripts, and run production changes with `--dry-run` first to read the SQL before it touches data:

```bash
node scripts/create-user.mjs <username> <password> --role officer --display "Name" --remote
node scripts/set-user-role.mjs <username> --role officer --executive --remote --dry-run
node scripts/set-user-role.mjs <username> --role officer --executive --remote
```

`--role` is required and the result is fully determined by the flags: without `--executive` the flag is turned off. The officer role can only be given to an `approved` account, and the script re-reads the account afterwards and exits with an error if the values are not what it asked for. An unknown username and a not-yet-approved account both fail loudly instead of reporting success.

Migration `0008` backfilled every account that existed before the roles feature as `officer`, `approved`, without the executive flag, so the first release changed nobody's permissions. The deploy workflow applies remote migrations before it deploys the Worker, after recording a Time Travel bookmark, and the migration only adds columns, so rolling the Worker back needs no data restore.

Before the release that opens the forums, audit the roster:

1. Read the accounts: `npx wrangler d1 execute tcn-content --remote --command 'select username, display_name from users'`. This is read-only but it reads production data, so run it yourself or get explicit approval first.
2. Compare them with the titles in `src/data/members.json`.
3. Demote accounts that are not officers (auditor, senior adviser) with `set-user-role.mjs --role member`. They lose their seminar and Q&A write access, so tell them.
4. Fill in the display name of every officer account that has none.
5. Grant the executive flag to the president and vice presidents. Confirm whether the senior vice president counts as a vice president. Without an executive account nobody can hide a post or approve a sign-up.
````

- [ ] **Step 2: README와 CONTENT_ARCHITECTURE의 명령 예시를 고친다**

`README.md`의 `### 콘텐츠 운영` 코드 블록을 다음으로 바꾼다.

```bash
# 계정 발급 (--remote 없으면 로컬 D1). --role 은 필수이고 임원은 officer, 일반 회원은 member 다.
node scripts/create-user.mjs <아이디> <비번> --role officer --remote --display "이름"

# 역할 변경, 회장·부회장 지정(결정권). 운영 DB 에는 먼저 --dry-run 으로 SQL 을 확인한다.
node scripts/set-user-role.mjs <아이디> --role officer --executive --remote

# 세미나 글 시드 (멱등)
node scripts/seed-seminar-posts.mjs --remote
```

같은 절의 문장 `권한은 flat(인증된 회원 누구나 등록·수정), 삭제는 soft delete입니다.`를 `승인된 임원(officer) 계정만 등록·수정할 수 있고, 삭제는 soft delete입니다.`로 바꾼다.

`CONTENT_ARCHITECTURE.md`의 62행 `계정: node scripts/create-user.mjs <id> <pw> [--remote]`를 `계정: node scripts/create-user.mjs <id> <pw> --role officer|member [--remote]`로 바꾼다. 이 문서의 나머지 개정은 명세서대로 2단계에서 한다.

- [ ] **Step 3: 전체 검증을 새로 실행한다**

`superpowers:verification-before-completion`에 따라 아래를 모두 실행하고 출력을 확인한 뒤에만 완료를 말한다.

```bash
npm run check
npm test
npm run build
npm run audit
./node_modules/.bin/wrangler d1 migrations apply tcn-content --local
npm run test:qna:d1
npm run test:roles:d1
npx prettier --check $(git diff --name-only main...HEAD -- '*.ts' '*.mjs' '*.astro' '*.md' '*.yml' '*.json')
```

Expected: 모두 성공. `npm test`는 커버리지 기준(statements 83, branches 71, functions 82, lines 87)을 넘어야 한다. 새 코드는 단위 테스트가 있으므로 기준을 낮출 이유가 없다. 기준이 올랐으면 `vitest.config.ts`의 값을 함께 올린다. Prettier가 실패하면 해당 파일만 `npx prettier --write <file>`로 고치고 다시 확인한다.

브라우저 게이트(`npm run verify`, `a11y`, `verify:admin`)는 CI가 실행한다. 로컬에서 돌리려면 `.dev.vars`(gitignore 대상)에 `SESSION_SECRET`이 필요하다. 있으면 `npm run verify:admin`만이라도 돌려 `create-user.mjs --role officer` 호출 변경을 확인한다.

- [ ] **Step 4: 독립 리뷰를 받는다**

전역 규칙에 따라 코드리뷰는 `/antigravity:review`로 한다. 저장소 안에서 실행하면 파일 탐색 때문에 5분 타임아웃에 걸리므로, 저장소 밖 디렉터리에서 diff를 stdin으로 전달하고 프롬프트에 "도구 사용 금지, diff만 텍스트로 리뷰"를 넣는다.

```bash
git diff main...HEAD > "$SCRATCH/phase1.diff"
```

지적마다 근거 파일을 직접 열어 사실 여부를 확인하고, 살아남은 것만 반영한다. diff 밖 참조(삭제한 것의 잔존 사용처)는 grep으로 직접 확인한다.

```bash
grep -rn "requireAdminMutation\|QnaSecurityError('forbidden\|getSessionUid" src scripts | grep -v "\.test\.ts"
```

Expected: `getSessionUid`는 `guard.ts`, `index.ts`, `api/auth/logout.ts`, `api/questions/index.ts`, `admin/login.astro`에만 남는다. `requireAdminMutation`은 어디에도 남지 않는다.

- [ ] **Step 5: 변경 이력을 남기고 커밋한다**

`pr-changelog` 스킬을 적용해 `CHANGELOG.md`에 PR을 만드는 날짜의 항목을 추가한다. 내용은 다음을 담는다. 영어로 쓰고 기존 항목과 같은 형식(분류, 문장, `(Branch: ...) - Implemented by Claude`)을 따른다.

- `0008` 마이그레이션이 역할·상태·결정권 컬럼을 더하고 기존 계정을 `officer`, `approved`, 결정권 없음으로 이전한다.
- `canAccess` 매트릭스, `getSessionUser`, 임원 가드 여섯 가지(API용과 페이지용 각각 세 가지), `requireMutation`이 추가되었다.
- 세미나, 미디어, 정리, Q&A 답변 경로와 어드민 페이지 다섯 곳이 "세션이 있으면 통과"에서 "승인된 임원만 통과"로 바뀌었다. 기존 계정은 모두 임원으로 이전되므로 동작은 그대로다.
- Q&A CSRF 토큰 형식은 그대로이고 오류 클래스만 공용 이름이 되었다.
- `create-user.mjs`가 `--role`을 필수로 받고 `set-user-role.mjs`가 추가되었으며, 두 스크립트에 `--dry-run`이 생겼다. CI 브라우저 게이트의 계정 발급 호출도 맞췄다.
- `/api/auth/me` 응답에 `role`, `status`가 추가되었다.
- 새 경로가 가드를 빠뜨리면 실패하는 커버리지 테스트와 `test:roles:d1` CI 단계가 추가되었다.

```bash
git add docs/operations-runbook.md README.md CONTENT_ARCHITECTURE.md CHANGELOG.md
git commit -m "docs: document account roles and record the phase 1 changelog"
```

**push와 PR은 사용자가 명시적으로 요청할 때만 한다.** 요청을 받으면 PR 본문에 같은 CHANGELOG 항목을 복사한다. 이 PR은 마이그레이션을 포함하므로, 배포 워크플로가 원격 마이그레이션을 코드 앞에서 적용하고 Time Travel 북마크를 남긴다는 점(위 "계획 작성 중 확인한 사실" 3번)을 PR 본문에 적는다. 2026-10-19 이후에는 첫 CI와 배포 결과에서 Ubuntu 26 전환 영향도 확인한다.

---

## Self-Review

**1. 명세서 커버리지.** 명세서 13장의 1단계 행을 항목별로 대응시켰다.

| 명세서 항목                                                                                          | 작업                                                              |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `0008` 마이그레이션(`is_executive` 포함)                                                             | Task 1                                                            |
| `getSessionUser`와 공용 가드(`requireExecutive` 포함)                                                | Task 4, Task 5                                                    |
| `canAccess` 매트릭스 전체                                                                            | Task 3                                                            |
| 교체 대상 11개                                                                                       | `qna/security.ts`는 Task 5, API 5개는 Task 6, 페이지 5개는 Task 7 |
| 커버리지 테스트                                                                                      | Task 8                                                            |
| 스크립트 변경                                                                                        | Task 9                                                            |
| 이전 회귀 테스트                                                                                     | Task 1(데이터), Task 3(권한)                                      |
| `/api/auth/me` 응답 필드                                                                             | Task 8                                                            |
| `docs/operations-runbook.md`와 `CHANGELOG.md`                                                        | Task 10                                                           |
| 6.2 CSRF 호환                                                                                        | Task 5                                                            |
| 12장 검증 계획 중 1단계 해당 행(권한 판정, 경로 가드 누락 방지, 가드 동작, DB 제약, 1단계 동작 보존) | Task 3, 8, 4·5·6, 1, 1·3                                          |

명세서의 캐시·색인 헤더(8.4)와 화면 행은 2·3단계 범위라 이 계획에 없다.

**2. 자리 표시자 검사.** "TBD", "나중에 구현", "적절한 오류 처리"류 문구를 찾아 확인했고 남은 것이 없다. 처음 초안의 Task 3 마지막 테스트에 "구현자가 단순화한다"는 안내가 남아 있었으나, 완성된 테스트 코드로 바꾸었다.

**3. 타입 일관성.** 이름을 작업 사이에서 대조했다. `SessionUser`, `Requirement`, `meetsRequirement`는 Task 3에서 정의하고 Task 4, 5가 같은 이름으로 쓴다. `GuardResult`는 Task 4에서 정의하고 Task 6, 7이 쓴다. `requireMutation`의 반환은 `{ user }`이고 Task 5의 `admin-route.ts`가 `.user.id`를 쓴다. `createCsrfToken(scope, sessionToken, secret)`의 인자 순서는 Task 5의 테스트, 구현, 두 Q&A 페이지 호출부가 같다. 페이지 가드의 `loginUrl` 옵션은 Task 4에서 정의하고 Task 7이 쓴다.

**4. Review Focus.** 다섯 항목 모두 테스트가 있다. 1번은 `permissions.test.ts`의 `ignores is_executive for %s`와 `mutation.test.ts`의 `a member carrying the executive flag`, 2번은 `permissions.test.ts`의 pending·rejected officer 테스트와 `require.test.ts`, 3번은 `mutation.test.ts`의 `keeps the legacy Q&A token format`, 4번은 `guard.test.ts`의 `getSessionUser` 세 테스트, 5번은 `user-scripts.test.ts`다.

**자체 점검에서 고친 것.** 계획을 쓰며 세 가지를 바로잡았다. (1) 처음에는 `set-user-role.mjs`가 `meta.changes`로 성공을 판정하게 설계했으나 wrangler 출력에 그 필드가 없음을 실측해 `select` 검증으로 바꿨다. (2) 처음에는 `decided_by` 외래 키 검증에 `pragma foreign_keys=on`이 필요하다고 가정했으나 실측으로 불필요함을 확인해 뺐다. (3) 커버리지 테스트만으로는 `answer.ts`와 `visibility.ts`가 실패한다는 점을 Task 8 작성 중에 발견해 래퍼를 인정하는 규칙과 그 래퍼를 지키는 별도 테스트를 더했다.

**남은 위험.** 새 `set-user-role.mjs`의 `--remote` 경로는 로컬에서 검증할 수 없다. 원격 `d1 execute`가 확인 프롬프트를 띄우는지, `--json` 출력이 로컬과 같은 형태인지는 첫 운영 실행에서 확인된다. 스크립트는 파싱에 실패하면 성공을 가장하지 않고 오류로 끝나며, 런북은 `--dry-run`을 먼저 실행하라고 안내한다.
