# 게시판·사용자 관리 2단계 구현 계획

## 상태와 범위

상태: 로컬 통합 구현 및 검증 완료(2026-10-20). 운영 계정 대조·권한 적용·배포·공개 가입 활성화는 미실행이며 별도 승인 대상이다.

구현·감독·독립 리뷰·검증 결과는 [Phase 2 검증 기록](../../phase2-verification.md)에 정리한다. 브라우저 하네스는 매 실행마다 합성 계정을 생성·정리하며 원격 데이터에 접근하지 않는다.

Phase 1 구현과 기준선 검증은 완료했다. 2026-10-20 실행 결과는 67파일·720건 테스트, 타입 검사 오류·경고·힌트 0개, `test:roles:d1` 통과다. 이후 구현 변경은 별도로 검증한다.

기존 Phase 2(Forum)와 Phase 3(계정·사용자 관리)를 하나의 개발 범위로 묶는다. Phase 1 최종 검증·배포를 개발 착수 조건으로 삼지 않는다. 전체 구현 → 역할별 로컬 확인 → 최종 검증 → 승인 후 운영 배포 순서로 진행한다. 공개 가입 활성화는 별도 후속 단계다.

기준은 [설계 명세](../specs/2026-10-12-boards-and-roles-design.md)와 Obsidian의 `TCN 게시판 및 회원 등급 기능 요약.md`다. Phase 1의 기존 코드 블록은 당시 구현 기록이고 새 작업은 이 계획을 따른다.

## 1. 확정한 권한 모델

역할은 `member / officer`를 유지한다. 감사·고문 특별 접근은 `users.can_access_directors_forum` 정수 플래그(0/1, 기본 0)로 추가한다. 이번 예외 권한은 하나이므로 범용 권한 테이블은 만들지 않는다. 이름·직함·가입일을 코드에 하드코딩하지 않는다.

| 계정      | 조건                            | 총회 게시판 | 임원 게시판 | 세미나·미디어·Q&A 공식 답변 | 사용자 관리 |
| --------- | ------------------------------- | ----------- | ----------- | --------------------------- | ----------- |
| 비로그인  | 세션 없음                       | 불가        | 불가        | 불가                        | 불가        |
| 반려      | rejected                        | 불가        | 불가        | 불가                        | 불가        |
| 준회원    | pending                         | 열람·작성   | 불가        | 불가                        | 불가        |
| 회원      | approved + member               | 열람·작성   | 불가        | 불가                        | 불가        |
| 감사·고문 | approved + member + 특별 접근 1 | 열람·작성   | 열람·작성   | 불가                        | 불가        |
| 이사진    | approved + officer + 결정권 0   | 열람·작성   | 열람·작성   | 가능                        | 불가        |
| 결정권자  | approved + officer + 결정권 1   | 열람·작성   | 열람·작성   | 가능                        | 가능        |

- 공개 페이지·세미나 열람과 기존 Q&A 질문은 비로그인도 가능하다. 반려 계정도 공개 기능과 본인 `/account`는 이용한다.
- 상태를 먼저 판정한다. pending/rejected의 특별 접근·임원·결정권 플래그는 보호 기능을 추가하지 않는다.
- 임원 게시판 식별자는 `directors`, 총회는 `assembly`로 통일한다.
- 글 수정은 해당 게시판에 접근 가능한 작성자만, 숨김은 같은 조건의 본인 또는 결정권자만 가능하다. 결정권자도 타인의 글을 수정하지 못한다.
- 기본 등급 계산과 임원 게시판 특별 접근을 분리한다. 특별 접근으로 세미나·미디어·공식 답변이 열리지 않아야 한다.
- 역할·상태·특별 접근은 매 요청 D1에서 읽는다. 세션 토큰에 넣지 않는다.
- 신규 가입 기본값은 `member / pending / 결정권 0 / 특별 접근 0`이다. 승인은 회원 상태만 바꾼다. 이후 직책을 부여받으면 현재 권한으로 접근을 판단한다.

### 결정권자 보호·변경 규칙

- 승인된 결정권자가 다른 일반 계정의 상태·역할·결정권·특별 접근을 관리한다.
- 자기 자신은 변경 대상에서 제외한다.
- 변경 전 `is_executive = 1`인 계정은 모두 보호한다. 회장과 부회장은 서로의 역할·결정권뿐 아니라 상태·특별 접근도 변경할 수 없다. 비정상 상태의 결정권자도 보호한다.
- 새로 승격된 결정권자도 이후 같은 보호를 받는다. 사이트에서 기존 결정권자 해제는 불가능하며, 교체·해제는 별도 운영 절차로 수행한다. username이나 직함 문자열로 보호 대상을 판정하지 않는다.
- 상태 전이는 `pending → approved`, `pending → rejected`, `rejected → approved`만 제공한다. 승인된 회원의 제명·승인 취소는 범위 밖이다.
- 역할·결정권·특별 접근 변경은 승인된 대상만 가능하다. 세 값을 최종 상태 전체로 저장한다. 결정권 1은 officer만, 특별 접근 1은 member만 허용한다. officer로 바꾸면 특별 접근을 0으로 명시한다.
- 서버는 저장 직전에 수행자 권한·대상 보호·revision을 재검사한다. UI 버튼 제한만으로 처리하지 않는다.

## 2. 데이터·API 계약

### 마이그레이션

기존 `0008`은 수정하지 않는다. 착수 시 최신 번호 충돌을 확인한다.

| 파일                                    | 변경                                          |
| --------------------------------------- | --------------------------------------------- |
| `migrations/0009_forum_access.sql`      | users 특별 접근 플래그, forum_posts           |
| `migrations/0010_user_audit_events.sql` | 사용자 상태·권한 감사 기록과 원자적 변경 지원 |

Forum은 명세 5.2를 따른다. 제목 1~120자, 본문 1~10000자, 공백뿐인 값·NUL 금지, board 허용 값 제약, 작성자 FK, revision 1 이상, ISO 시각, deleted_at/deleted_by 동시 설정, 목록용 board·숨김·시각·id 인덱스를 포함한다.

사용자 감사 기록은 대상/수행자 id, 동작, 변경 전후 status/role/is_executive/can_access_directors_forum, 전후 revision, request_id, 요청 지문, 시각을 저장한다. 동작은 approved/rejected/reapproved/permissions_changed다. request_id와 (대상, 이전 revision)는 유일하다. 이메일·비밀번호·세션·CSRF는 저장하지 않는다. 상태 변경만 decided_by/decided_at을 갱신한다.

### 경로

| 경로                                | 계약                                                                |
| ----------------------------------- | ------------------------------------------------------------------- |
| `/forum/[board]`                    | SSR 목록, 최신순 created_at/id, 20건                                |
| `/forum/[board]/new`                | 작성 화면                                                           |
| `/forum/[board]/[id]`               | 상세·본인 수정·숨김                                                 |
| `POST /api/forum/[board]`           | title/body; 작성자는 세션에서 결정                                  |
| `PUT /api/forum/[board]/[id]`       | title/body/expectedRevision                                         |
| `DELETE /api/forum/[board]/[id]`    | expectedRevision; 숨김 및 revision 증가                             |
| `/admin/users`                      | 결정권자 목록, status/page, 20건, 대기 건수                         |
| `PATCH /api/users/[id]/status`      | status/expectedRevision/requestId                                   |
| `PATCH /api/users/[id]/permissions` | role/isExecutive/canAccessDirectorsForum/expectedRevision/requestId |
| `/login`, `/account`, `/signup`     | 일반 로그인·본인 상태·가입                                          |
| `POST /api/auth/signup`             | 이메일·비밀번호·이름·선택 소속, 권한 입력 금지                      |

목록·상세는 SSR과 공용 repository를 사용하며 초기 별도 GET API는 만들지 않는다. API 응답은 세션 없음 401, 권한 부족/자기 계정/보호 대상 403, 없는 대상·board·숨긴 글 404, 잘못된 입력 400, revision·전이 충돌 409다. 글 접근 권한 확인 후 글 상태를 판정하며 URL board와 저장된 board가 일치해야 한다.

Forum 변경은 `requireMutation(scope: forum, require: activeAccount)` 후 게시판/소유권 검사, 사용자 변경은 users/executive 후 대상 검사로 보호한다. signup은 세션이 없으므로 별도 출처·입력·플래그 검사를 적용한다. 기존 로그인 Turnstile·속도 제한·장치 쿠키를 유지한다.

### 원자성·동시 변경·재시도

- 글 변경은 id/board/revision/미숨김 조건을 만족할 때만 revision을 증가시킨다.
- 사용자 변경은 수행자의 최신 승인·임원·결정권, 대상 보호 여부, expectedRevision을 저장 조건에 포함한다.
- 계정 변경과 감사 기록은 하나의 원자적 D1 작업으로 저장한다. 어느 쪽이든 실패하면 둘 다 남지 않아야 한다.
- 저장 방식은 D1의 한 배치에서 조건부 사용자 UPDATE 후 감사 INSERT 순서로 고정한다. 감사 INSERT의 검증 트리거는 실제 사용자 revision·권한이 감사의 after 스냅샷과 일치하는지 확인하고, 불일치하면 SQL 오류로 배치 전체를 취소한다. 감사의 고유 (대상, before_revision) 제약은 동일 revision의 다른 요청이 기존 변경을 감사 없이 덮어쓰는 것을 막는다. 영향 행 0건을 성공으로 처리하지 않으며 Task 2에서 실제 D1로 경합·실패를 증명한다.
- 동일 수행자·requestId·대상·요청 내용의 재시도는 현재 권한을 재검사한 뒤 기존 성공 결과를 반환한다. 새 변경·감사는 만들지 않는다. requestId 내용이 다르면 409, 수행자 권한이 회수됐으면 403이다.
- 동일 revision 경합은 한 요청만 성공한다. 수행자 강등·대상 결정권자 승격과 경합해도 권한 보호가 유지되어야 한다.

## 3. 구현 Task

공통: 행동 변경은 실패 테스트 → 구현 → 관련 테스트 → 타입 검사 순서로 수행한다. 체크박스는 실제 검증 후 갱신한다. 커밋·push·PR·운영 변경은 자동 수행하지 않는다.

### Task 1: 로컬 준비·권한 확장

수정: `src/lib/db/types.ts`, `users.ts`, `src/lib/auth/permissions.ts`, `guard.ts`, `require.ts`, `index.ts`와 해당 테스트. 생성: 0009 마이그레이션.

- [x] 로컬 D1 백업을 확보하고 로컬 마이그레이션을 적용한다. 원격 D1은 변경하지 않는다.
- [x] User·SessionUser에 canAccessDirectorsForum을 추가하고 매 요청 조회한다.
- [x] 기본 등급과 게시판 접근 판정을 분리한다. 기존 officer/executive 가드는 운영 권한을 유지한다.
- [x] 익명/반려/준회원/회원/특별 접근/이사/결정권자 표 기반 read/write/edit/delete 테스트를 작성한다.
- [x] pending/rejected의 특별 접근, member의 결정권 같은 비정상 조합을 검증한다.
- [x] 접근 회수 후 본인 글 수정·숨김도 불가능한지 확인한다.

완료 증거: 관련 단위 테스트와 타입 검사 통과. 최종 빌드·배포가 착수 선행 조건은 아니다.

### Task 2: 사용자 변경·감사 저장 계층

생성: 0010 마이그레이션, `src/lib/users/permissions.ts`, `repository.ts`와 테스트. 수정: `src/lib/db/users.ts`; 기존 D1 테스트 하네스를 재사용한다.

- [x] 대상 보호·상태 전이·최종 권한 조합을 순수 함수로 정의한다.
- [x] 조건부 UPDATE + 감사 INSERT 배치와 감사 스냅샷 검증 트리거를 구현하고 사용자 revision과 감사 전후 revision을 함께 증가시킨다.
- [x] 실제 임시 로컬 D1에서 감사 실패·계정 변경 실패·영향 행 0건·중복 requestId·revision 경합을 재현한다.
- [x] 자기 자신·기존/신규 결정권자·비정상 상태 결정권자를 보호한다.
- [x] 수행자 강등·대상 승격 경합과 롤백을 검증한다.

완료 증거: 단위 테스트와 실제 D1 검증 통과. API는 검증된 이 계층만 호출한다.

### Task 3: Forum 저장 계층·API

생성: `src/lib/forum/repository.ts`, `payload.ts`와 테스트, `src/pages/api/forum/[board]/index.ts`, `[id].ts`. 수정: route-guard-coverage 테스트.

- [x] 길이·공백·NUL·revision·페이지·board 검증과 목록/상세/생성/수정/숨김을 구현한다.
- [x] 작성자 이름만 반환하고 username/이메일/해시는 노출하지 않는다.
- [x] board 간 id 바꿔치기·타인 수정·숨긴 글·409·CSRF·Origin 오류를 검증한다.
- [x] 특별 접근 사용자의 기존 세미나·미디어·공식 답변 API가 계속 403인지 확인한다.
- [x] 신규 경로를 가드 누락 검사에 포함한다.

완료 증거: repository·API·D1 제약 검증 통과.

### Task 4: 로그인·계정·가입 기반

생성: `src/pages/login.astro`, `account.astro`, `signup.astro`, `api/auth/signup.ts`. 수정: admin/login, login/me API, 이동 유틸·테스트, Worker 변수 타입, .env.example.

- [x] 기존 username 로그인을 유지하고 /admin/login을 /login으로 통합한다.
- [x] returnTo는 /admin·/forum·/account만 허용하고 외부 URL·역슬래시 우회를 거부한다.
- [x] 기본 이동: 임원 /admin, 회원·감사·고문·준회원 /forum/assembly, 반려 /account.
- [x] account는 본인 상태·소속·이름·권한별 링크·로그아웃을 제공한다. 기존 username을 이메일로 오표시하지 않는다.
- [x] 가입 이메일 정규화·중복·길이·선택 소속을 검사한다. 기존 공용 비밀번호 정책을 재사용하고 상한 128자를 적용한다.
- [x] 가입 권한 필드 주입을 거부하고 최소 권한으로 생성·자동 로그인해 /account로 보낸다.
- [x] SIGNUP_ENABLED가 정확히 true가 아니면 페이지/API 모두 404다. 운영 기본 off, 로컬은 true로 흐름을 검증한다.
- [x] me API는 메뉴에 필요한 capability만 추가한다. raw 결정권 플래그·비밀번호·감사 정보는 내려주지 않는다.

완료 증거: off/on·가입 입력·권한 주입·중복·로그인 보안 회귀·이동 테스트 통과.

### Task 5: 사용자 관리 API·화면

생성: `src/pages/api/users/[id]/status.ts`, `permissions.ts`, `src/pages/admin/users/index.astro`, 필요한 관리자 컴포넌트·테스트. 수정: 관리자 메뉴·대기 건수·가드 커버리지.

- [x] users 변경 가드와 Task 2 저장 계층을 연결한다.
- [x] status/page·20건 목록, pending 오래된 순·나머지 결정 시각 최신순, id 보조 정렬을 구현한다.
- [x] 이름·소속·상태·역할·특별 접근·결정권·가입일·최근 결정자 및 필요한 이메일만 표시한다.
- [x] 승인/반려/복구·최종 권한 변경 UI와 확인을 제공한다. 결정권 부여 후 보호 대상이 됨을 설명한다.
- [x] 자기 자신·기존 결정권자는 읽기 전용이며 직접 API 변경도 403이다.
- [x] 409는 최신 상태 재조회로 안내하고 실패를 성공 표시하지 않는다.
- [x] 상대 결정권자를 rejected로 바꾸는 우회도 차단하는지 검증한다.

완료 증거: API·UI 및 실제 사용자 변경 D1 검증 통과.

### Task 6: Forum 화면·탐색·응답 헤더

생성: `src/pages/forum/[board]/index.astro`, `new.astro`, `[id].astro`, 필요한 컴포넌트. 수정: Header/Footer, i18n, middleware, 사이트맵·헤더 테스트.

- [x] 제목·작성자·날짜 중심의 기록형 목록과 기존 pagination을 사용하고 작성/수정/숨김·빈 상태·오류를 제공한다.
- [x] 본문은 이스케이프한 일반 텍스트와 줄바꿈만 표시하고 이메일은 제외한다.
- [x] 정적 페이지 메뉴도 me capability를 사용한다. 실제 SSR/API 권한 검사는 별도로 수행한다.
- [x] 감사·고문은 Directors/Assembly/Account 링크를 받지만 운영 관리자 메뉴는 받지 않는다.
- [x] forum·users·account/login/signup·auth/me의 성공/오류/리다이렉트에 no-store/noindex를 적용한다. 기존 보안 헤더를 유지하고 비공개 경로는 sitemap에서 제외한다.
- [x] Impeccable 기준과 기존 i18n을 적용하고 키보드·레이블·오류·모바일을 확인한다.
- [x] 아래 릴리스 gate의 off/on을 페이지·API·메뉴에서 검증한다.

완료 증거: 경로·헤더·메뉴 테스트 통과와 로컬 역할별 화면 확인 준비.

### Task 7: 운영 예행연습·문서

생성: `scripts/verify-forum-d1.mjs`, `verify-users-d1.mjs`, `verify-forum-users.mjs`, `set-user-forum-access.mjs`. 수정: package scripts·CI, 역할 스크립트·테스트, 제품·운영 문서.

- [x] test:forum:d1, test:users:d1, verify:forum-users 명령을 등록한다. D1 검증은 격리된 임시 로컬 상태를 사용한다.
- [x] 특별 접근 스크립트는 --allow/--revoke와 --dry-run을 제공한다.
- [x] 역할 스크립트는 officer 전환 시 특별 접근을 0으로 정리하고 revision을 증가시킨다. 사용자 관리 도입 후 운영 변경에는 수행자·requestId·감사 기록을 남긴다.
- [x] 초기 결정권자 bootstrap과 보호 대상 교체는 별도 운영 절차로 기록한다. UI 보호 해제 API는 만들지 않는다.
- [x] 역할별 합성 id fixture로 신규 가입→준회원→승인→게시판→권한 변경 흐름을 확인한다.
- [x] 운영 매핑 원칙을 문서화했다(실제 계정 적용은 미실행). 실제 매핑은 회장·수석부회장 결정권자, 이사 3명 officer, 감사·선임고문 approved member+특별 접근이다. username을 추정하거나 미확인 계정을 자동 강등하지 않는다.
- [x] IDEA/PRODUCT/CONTENT_ARCHITECTURE/MEMBERSHIP_FLOW, content-operations/operations-runbook/deployment, .env.example을 갱신한다. CHANGELOG는 PR 요청 시 해당 스킬에 따라 기록한다.

완료 증거: 로컬 전체 흐름 및 결정권자 보호 확인. 운영 계정 변경은 실행하지 않고 검토 가능한 매핑·SQL로 준비한다.

### Task 8: 전체 완료 후 최종 검증

- [x] npm test/check와 test:qna:d1, test:roles:d1, test:forum:d1, test:users:d1 실행.
- [x] 변경 파일 Prettier와 git diff --check 실행.
- [x] 로컬 콘텐츠 검증 빌드 후 verify/a11y/verify:admin/verify:founding-media/verify:seminar-carousel/verify:forum-users 실행.
- [x] npm run audit 및 최종 diff·권한 검토. 실패·미확인은 기록한다.
- [x] 사용자에게 전체 기능을 확인할 로컬 주소·테스트 계정을 제공한다.

## 4. 릴리스와 가입 공개

1. 전체 구현과 로컬 통합 검증을 끝낸다. 구현 중에도 관련 테스트·타입 검사를 수행한다.
2. 운영 계정 매핑과 변경 SQL을 읽기 전용으로 확인해 검토 가능한 결과를 준비한다.
3. 승인 후 완성된 기능을 한 릴리스로 배포한다. Forum과 사용자 관리의 부분 운영 배포는 하지 않는다.
4. 마이그레이션·초기 권한 설정 중 신규 비공개 경로가 노출되지 않도록 `MEMBER_FEATURES_ENABLED`가 정확히 true일 때만 Forum·사용자 관리 화면/API를 연다. 기본은 false이며 false이면 503, 메뉴에서도 숨긴다. 기존 기능은 유지한다.
5. 초기 운영 계정·두 결정권자·감사/고문 특별 접근을 검토된 스크립트로 반영하고 재조회한다. 역할별 smoke check 후 gate를 열어 기능을 확인한다.
6. 수동 배포는 저장소 규칙의 `TCN_CONTENT_SOURCE=remote npm run build && npx wrangler deploy`를 사용한다. 운영 데이터 변경·push·PR·merge·deploy는 각각 사용자 승인 범위에서만 수행한다.
7. 가입은 계속 off로 둔다. 개인정보 처리방침·스팸/남용 방어·계정 열거 대책 완료와 별도 승인 후 켠다. 이메일 소유 인증은 기존 정책상 권장 사항이며 필수 여부를 임의로 변경하지 않는다. 미인증 안내와 비밀번호 복구 운영 절차를 제공한다.

릴리스 gate는 Task 4~6에서 서버/API·메뉴·테스트·변수 타입·.env.example에 구현한다. signup 플래그와 별개다. 가입을 켜지 않고도 수동 발급 계정으로 기능을 운영할 수 있다.

## 5. 인수 조건

- [x] 권한 표와 일치하며 감사·고문의 특별 접근이 운영 권한으로 확대되지 않는다.
- [x] 기존·신규 계정 모두 현재 상태와 권한으로 접근을 판정한다.
- [x] board/id 바꿔치기·직접 API 호출·상태 변경으로 제한을 우회하지 못한다.
- [x] 자기 자신과 기존/새 결정권자는 보호된다. 동시 변경과 재시도에서 사용자 상태·감사 기록이 일치한다.
- [ ] 전체 역할별 로컬 확인과 최종 검증 후 하나의 릴리스로 전달한다. 로컬 검증은 완료했으며 운영 계정 확인·배포 승인 대기다.
- [x] 초기 계정 검증 전에 신규 비공개 경로가 열리지 않으며 가입 공개는 별도 통제한다.
