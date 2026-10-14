# 게시판·역할 체계 설계

임원·회원 역할, 임원 게시판(Directors Forum), 총회 게시판(Assembly Forum), 가입 승인 절차를 추가하는 설계 명세서다.

| 항목      | 내용                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------- |
| 작성일    | 2026-10-12                                                                                               |
| 상태      | 설계 4개 섹션 승인 완료, 명세서 검토 대기                                                                |
| 진행 경로 | architectural (`superpowers:brainstorming`). 구현 계획은 단계별로 따로 작성한다.                         |
| 관련 문서 | [`IDEA.md`](../../../IDEA.md), [`PRODUCT.md`](../../../PRODUCT.md), [`CONTENT_ARCHITECTURE.md`](../../../CONTENT_ARCHITECTURE.md), [`MEMBERSHIP_FLOW.md`](../../../MEMBERSHIP_FLOW.md) |

## 1. 요약

TCN 사이트에 두 가지 역할(임원, 회원)과 세 가지 계정 상태(승인 대기, 승인 완료, 반려)를 도입한다. 승인된 계정만 역할에 따른 권한을 얻는다. 임원은 세미나 글과 Q&A 공식 답변을 관리하고, 임원 게시판과 총회 게시판을 사용하며, 가입자를 승인하거나 반려한다. 승인된 회원은 총회 게시판만 사용한다. 세미나 게시판과 익명 Q&A는 이미 구현되어 있으므로 새로 만들지 않는다.

작업은 세 단계로 나누어 순서대로 구현하고, 각 단계가 독립적으로 배포 가능해야 한다.

1. 역할·상태 기반과 권한 가드 교체
2. forum 엔진과 두 게시판
3. 공개 가입, 로그인, 임원용 사용자 관리

## 2. 배경

### 2.1 요구사항

- 이사회(Board of Directors)는 임원 회의다. 구성원은 회장, 부회장, 이사다.
- 총회(General Assembly)는 회원 회의다. 구성원은 승인된 회원이다.
- 게시판은 네 종류다.
  - 세미나 게시판: 누구나 열람한다. 이미 있다.
  - 임원 게시판: 임원만 열람한다.
  - 총회 게시판: 가입이 승인된 구성원만 열람한다.
  - Q&A 게시판: 익명으로 누구나 질문을 쓸 수 있다. 이미 있다.
- 역할은 임원과 회원 두 가지뿐이다.
- 가입한다고 바로 회원이 되지는 않는다. 임원이 승인해야 회원이 된다.
- 임원 게시판과 총회 게시판에서 글을 만들고, 고치고, 지울 수 있어야 한다.

### 2.2 현재 상태 (코드 실측)

- 런타임은 Astro 7과 Cloudflare Workers이고 저장소는 D1(`tcn-content`)과 R2(`tcn-media`)다.
- `users` 테이블은 `id`, `username`, `password_hash`, `display_name`, `created_at`, `session_version` 컬럼만 가진다. 역할과 상태 컬럼이 없다.
- 계정은 `scripts/create-user.mjs`로 수동 발급한다. 가입 화면이 없다.
- 인증은 HMAC 서명 쿠키(1일)이고 토큰에는 `uid`, 만료 시각, 세션 버전만 담긴다.
- 인증만 통과하면 누구나 세미나 글 등록·수정, 미디어 업로드, Q&A 공식 답변·공개 전환을 할 수 있다. 이 권한을 `getSessionUid`로 확인하는 비테스트 파일이 15개 있다.
- Q&A 변경 API는 `requireAdminMutation`(`src/lib/qna/security.ts`)으로 세션, 동일 출처, `sec-fetch-site`, CSRF 토큰을 모두 검사한다. CSRF 토큰은 `qna-csrf:<세션 토큰>`의 HMAC이다.
- 운영 배포(`.github/workflows/deploy-workers.yml`)는 D1 Time Travel 북마크를 남기고, 원격 마이그레이션을 적용하고, Worker를 배포하고, `/api/health`와 `/api/ready` 확인에 실패하면 Worker를 롤백한다. 운영 마이그레이션은 기존 Worker와 호환되는 추가 변경만 허용한다(`docs/operations-runbook.md`).
- `IDEA.md`의 범위 경계는 공개 회원가입과 커뮤니티 기능을 제외한다고 정하고 있다. 이 설계는 그 경계를 바꾸므로 14장의 문서 개정이 함께 필요하다.

### 2.3 목표와 비목표

목표는 다음과 같다.

- 임원과 회원 두 역할로 열람·작성 권한을 나눈다.
- 임원이 승인한 계정만 회원이 되는 가입 절차를 만든다.
- 기존 운영 동작을 1단계 배포에서 바꾸지 않는다.
- 새로 추가되는 경로가 권한 검사를 빠뜨리면 CI가 실패하게 한다.

비목표는 15장(후속 절차)에 따로 모았다.

## 3. 확정된 결정

| 번호 | 결정                                                                                                                                      | 근거                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| D1   | 역할은 `officer`와 `member` 두 개다. 승인 여부는 역할이 아니라 계정 상태(`pending`, `approved`, `rejected`)로 나타낸다.                    | 사용자 요구. 정관의 "준회원"(제5조)과 이름이 겹치지 않게 "승인 대기"로 부른다. |
| D2   | 임원은 회장, 부회장, 이사만이다. 감사, 명예회장, 고문은 임원이 아니다.                                                                    | 정관 제13조(이사회 구성)와 요구사항이 일치한다.                     |
| D3   | 총회 게시판은 승인된 모든 회원이 열람·작성한다. 정회원, 준회원, 기관회원 구분은 사이트에서 하지 않고 임원이 승인할 때 판단한다.           | 정관 제12조 "총회는 회원으로 구성한다".                             |
| D4   | 가입 승인은 임원 1명이 단독으로 한다. 승인자와 시각을 감사 기록으로 남긴다. 이사회 의결은 사이트 밖의 조직 절차로 둔다.                   | 사용자 결정. 정관 제5조·제13조의 의결 절차와 다르다는 점을 알고 선택했다. |
| D5   | 가입하면 계정이 즉시 생기고 `pending` 상태가 된다. 가입자가 신청글을 쓰지 않는다. 임원이 사용자 목록에서 승인 또는 반려한다.              | 사용자 결정. 별도 가입 게시판은 만들지 않는다.                      |
| D6   | 아이디는 이메일 주소만 허용한다. 필수 항목은 이메일, 비밀번호, 이름이고 소속은 선택이다.                                                  | 사용자 결정. 인증 메일은 후속 절차에서 보낸다.                      |
| D7   | 세미나 글 작성·수정·삭제와 Q&A 공식 답변은 임원만 한다.                                                                                   | 사용자 결정. `PRODUCT.md`의 "공식 기록 우선" 원칙과 맞다.           |
| D8   | 게시판 글 수정은 작성자 본인만, 삭제(숨김)는 작성자 본인과 임원이 할 수 있다.                                                             | 사용자 결정.                                                        |
| D9   | 기존 수동 발급 계정은 `officer`, `approved`로 이전한다. 회장·부회장·이사를 따로 나누지 않는다. 직함은 `src/data/members.json`이 계속 관리한다. | 사용자 결정. 직함에 따른 권한 차이가 없다.                          |
| D10  | 이메일 인증, 비밀번호 재설정, 스팸 방어는 후속 절차로 미룬다. 스팸 방어가 끝나기 전에는 공개 가입을 열지 않는다.                           | 사용자 결정.                                                        |

## 4. 역할·상태·권한 모델

### 4.1 판정 규칙

- 권한은 `status`가 `approved`인지 먼저 확인하고, 그다음에 `role`을 확인한다. `pending`과 `rejected` 계정은 `role` 값과 관계없이 어떤 보호 기능도 쓸 수 없다.
- `pending`과 `rejected` 계정은 로그인할 수 있고 `/account`에서 본인 상태만 확인할 수 있다.
- 역할과 상태는 세션 토큰에 넣지 않고 요청마다 D1에서 읽는다. 그래서 승인, 반려, 역할 변경이 즉시 반영되고 세션 버전을 올릴 필요가 없다.

### 4.2 권한 매트릭스

| 기능                         | 익명 | 승인 대기·반려 | 회원      | 임원      |
| ---------------------------- | ---- | -------------- | --------- | --------- |
| 세미나 열람                  | 가능 | 가능           | 가능      | 가능      |
| 세미나 작성·수정·삭제        | 불가 | 불가           | 불가      | 가능      |
| 미디어 업로드·삭제           | 불가 | 불가           | 불가      | 가능      |
| Q&A 질문 작성                | 가능 | 가능           | 가능      | 가능      |
| Q&A 공식 답변·숨김           | 불가 | 불가           | 불가      | 가능      |
| 총회 게시판 열람·작성        | 불가 | 불가           | 가능      | 가능      |
| 임원 게시판 열람·작성        | 불가 | 불가           | 불가      | 가능      |
| 게시판 글 수정               | 해당 없음 | 해당 없음 | 본인 글만 | 본인 글만 |
| 게시판 글 삭제(숨김)         | 해당 없음 | 해당 없음 | 본인 글만 | 모든 글   |
| 사용자 목록 조회             | 불가 | 불가           | 불가      | 가능      |
| 가입 승인·반려·반려 복구     | 불가 | 불가           | 불가      | 가능      |
| 본인 상태 확인(`/account`)   | 불가 | 가능           | 가능      | 가능      |

### 4.3 계정 상태 전이

| 전이                      | 동작       | 허용 대상                                |
| ------------------------- | ---------- | ---------------------------------------- |
| `pending` → `approved`    | 승인       | 임원이 일반 회원 계정에 대해서만         |
| `pending` → `rejected`    | 반려       | 임원이 일반 회원 계정에 대해서만         |
| `rejected` → `approved`   | 반려 복구  | 임원이 일반 회원 계정에 대해서만         |

- 임원 본인과 다른 임원 계정의 상태는 바꿀 수 없다.
- 같은 이메일로 다시 가입하는 것은 `username`의 유일 제약이 막는다. 반려된 사람은 임원이 복구해야 한다.
- 임원 역할은 화면에서 부여하지 못하고 운영자 스크립트로만 부여한다. 임원 한 명이 임의로 다른 사람을 임원으로 올리는 권한 상승 경로를 만들지 않기 위해서다.
- 회원 제명과 승인 취소는 이번 범위에 넣지 않는다. 정관 제6조에서 이사회 의결 사항이다.

## 5. 데이터 모델

마이그레이션은 기존 규칙에 따라 추가만 하고, 번호는 현재 마지막 `0006` 다음부터 쓴다. 파일 이름은 구현 계획에서 확정한다.

### 5.1 `users` 컬럼 추가 (`0007`, 1단계)

```sql
alter table users add column role        text    not null default 'member'
  check (role in ('officer', 'member'));
alter table users add column status      text    not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));
alter table users add column affiliation text;
alter table users add column revision    integer not null default 1 check (revision >= 1);
alter table users add column decided_by  text references users(id);
alter table users add column decided_at  integer;

-- 기존 수동 발급 계정은 지금 모든 권한을 가지고 있으므로 동작을 유지한다.
update users set role = 'officer', status = 'approved';
```

- 기본값은 가장 권한이 낮은 `member`, `pending`이다. 새 행이 실수로 권한을 갖지 않게 하기 위해서다.
- `decided_by`와 `decided_at`은 가장 최근 승인·반려 결정을 가리키고, 사용자 관리 화면이 읽는다. 이력은 5.3의 감사 기록이 가진다.
- `decided_at`은 같은 테이블의 `created_at`처럼 유닉스 초 정수다.
- 이메일은 별도 컬럼 없이 `username`에 소문자로 저장한다. 기존 계정의 `username`은 이메일 형식이 아니며, 이메일 형식 검사는 신규 가입에만 적용한다.
- 허용 값 제약(`check`)을 `alter table add column`과 함께 쓸 수 있는지는 구현 계획의 첫 작업에서 로컬 D1로 검증한다. 불가하면 애플리케이션 계층의 검증과 테스트로 대신하고, 그 사실을 계획 문서에 기록한다.

### 5.2 `forum_posts` (`0008`, 2단계)

```sql
create table forum_posts (
  id          text primary key,
  board       text not null check (board in ('directors', 'assembly')),
  title       text not null
                check (length(trim(title)) between 1 and 120)
                check (instr(title, char(0)) = 0),
  body        text not null
                check (length(trim(body)) between 1 and 10000)
                check (instr(body, char(0)) = 0),
  author_id   text not null references users(id),
  revision    integer not null default 1 check (revision >= 1),
  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at  text,
  deleted_by  text references users(id),
  check ((deleted_at is null) = (deleted_by is null))
);

create index forum_board_created
  on forum_posts (board, deleted_at, created_at desc, id desc);
```

- 시각 컬럼은 같은 계열인 Q&A 테이블의 ISO 텍스트 형식을 따른다.
- 삭제는 실제 삭제가 아니라 `deleted_at`과 `deleted_by`를 채우는 숨김이다.

### 5.3 `user_audit_events` (`0009`, 3단계)

```sql
create table user_audit_events (
  id              text primary key,
  target_user_id  text not null references users(id),
  actor_user_id   text not null references users(id),
  action          text not null check (action in ('approved', 'rejected', 'reapproved')),
  before_status   text not null,
  after_status    text not null,
  before_revision integer not null check (before_revision >= 1),
  after_revision  integer not null check (after_revision = before_revision + 1),
  request_id      text not null unique,
  created_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (target_user_id, before_revision)
);
```

구조는 `qna_audit_events`를 따른다. 감사 기록에는 이메일이나 비밀번호 같은 개인정보를 넣지 않는다.

## 6. 권한 강제 방식

### 6.1 공용 모듈

`src/lib/auth/`에 다음을 추가한다.

- `getSessionUser(request)`: 세션이 유효하면 `id`, `username`, `displayName`, `role`, `status`를 반환하고, 아니면 `null`을 반환한다. 기존 `getSessionUid`가 이미 사용자 행을 읽으므로 DB 조회 횟수는 늘지 않는다.
- `requireOfficer`, `requireApprovedMember`: 페이지용과 API용을 구분한다. 페이지는 비로그인이면 `/login`으로 보내고 권한이 없으면 안내 화면을 보여 준다. API는 비로그인이면 401(`unauthorized`), 권한이 없으면 403(`forbidden`)을 반환한다.
- `canAccess(user, action)`: 4.2의 매트릭스를 그대로 구현한 순수 함수다.
- `requireMutation(request, { scope, require })`: `requireAdminMutation`을 일반화한 것이다. 세션, 동일 출처, `sec-fetch-site`, CSRF를 모두 검사하고 역할 조건을 추가로 확인한다.

### 6.2 CSRF 토큰 호환

CSRF 토큰은 `scope`로 도메인을 분리한다(`qna-csrf:`, `forum-csrf:`, `users-csrf:`). Q&A는 기존 접두사를 그대로 쓰므로 이미 열려 있는 관리 화면의 토큰이 배포 때문에 무효가 되지 않는다. 오류 클래스 이름만 공용 이름으로 바꾸고, 상태 코드와 오류 코드 문자열은 그대로 유지한다.

### 6.3 교체 대상

`getSessionUid`를 쓰는 비테스트 파일 15개의 처리는 다음과 같다.

| 처리                                | 대상                                                                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 임원 전용 가드로 교체 (11개)        | `qna/security.ts`(Q&A 답변·공개 전환), `admin/index`, `admin/posts/new`, `admin/posts/[id]`, `admin/questions/index`, `admin/questions/[id]`, `api/posts/index`, `api/posts/[id]`, `api/media/index`, `api/media/[id]`, `api/maintenance/media-cleanup` |
| 세션만 확인하고 가드는 쓰지 않음 (4개) | `api/auth/logout`, `api/auth/me`(응답에 `role`, `status` 추가), `api/questions/index`(익명 질문 허용), `admin/login`(`/login`으로 이동시킴)                                    |

### 6.4 커버리지 테스트

기존 `*-parity.test.ts` 방식으로 `src/lib/auth/route-guard-coverage.test.ts`를 추가한다. 이 테스트는 `src/pages/admin/**`, `src/pages/api/**`, `src/pages/forum/**`의 모든 경로 파일을 읽어서, 다음 중 하나를 만족하지 않으면 실패한다.

- 공용 가드 함수(`requireOfficer`, `requireApprovedMember`, `requireMutation`)를 호출한다.
- 테스트 파일 안의 명시적 공개 목록에 한 줄 사유와 함께 올라 있다.

초기 공개 목록은 `admin/login`, `api/auth/login`, `api/auth/logout`, `api/auth/me`, `api/auth/signup`, `api/health`, `api/ready`, `api/questions/index`다. 이 테스트는 호출 문자열의 존재를 확인하는 것이므로 가드가 올바르게 쓰였는지까지 증명하지는 못한다. 올바른 사용은 12장의 매트릭스 테스트와 핸들러 단위 테스트가 보완한다.

## 7. 가입·로그인·계정 화면

### 7.1 경로

| 경로                 | 용도                                                               | 렌더링 |
| -------------------- | ------------------------------------------------------------------ | ------ |
| `/login`             | 공개 로그인 화면. `/admin/login`은 이 경로로 이동시킨다.           | SSR    |
| `/signup`            | 가입 화면. `SIGNUP_ENABLED`가 켜졌을 때만 열린다.                  | SSR    |
| `/account`           | 본인 상태 확인과 로그아웃                                          | SSR    |
| `POST /api/auth/signup` | 가입 처리. `SIGNUP_ENABLED`가 꺼져 있으면 404를 반환한다.       | SSR    |

### 7.2 가입

- 입력 항목은 이메일(아이디), 비밀번호, 이름(필수), 소속(선택)이다. 전화번호, 생년월일, 주소는 받지 않는다(`MEMBERSHIP_FLOW.md`의 원칙).
- 이메일은 공백을 제거하고 소문자로 바꾸어 저장하며 형식과 길이(254자 이하)를 검사한다. 비밀번호는 10자 이상 128자 이하이고 이메일과 같은 값을 금지한다. 이름은 1~100자, 소속은 200자 이하다.
- 저장되는 계정은 `role = member`, `status = pending`이다. 비밀번호 해시는 기존 `hashPassword`를 재사용한다.
- 가입이 끝나면 세션 쿠키를 발급해 자동으로 로그인시키고 `/account`로 보낸다.
- 이미 쓰인 이메일이면 `email_taken`(409)을 반환한다. 로그인은 사용자 존재 여부를 숨기도록 만들어져 있으므로 이 응답은 계정 열거를 허용한다. 알려진 한계이며 후속 스팸·남용 방어 설계에서 다룬다.

### 7.3 공개 시점 분리

`SIGNUP_ENABLED`는 Workers 변수(`vars`)이고 값이 정확히 `true`일 때만 가입이 열린다. 변수가 없거나 다른 값이면 꺼진 것으로 본다. `/api/ready`의 검사 대상에는 넣지 않는다. 시크릿이 아니고, 꺼진 상태가 정상이기 때문이다. 켜는 일은 설정 변경이므로 변경 이력이 git에 남는다. 개인정보 처리방침과 스팸 방어가 갖춰지기 전에는 켜지 않는다.

### 7.4 로그인과 이동

- 로그인 API(`/api/auth/login`)의 인증 방식과 속도 제한은 그대로 두고, 성공 응답에 `role`과 `status`를 추가한다.
- 로그인 후 이동할 곳은 안전하다고 검증된 `returnTo`가 있으면 그곳이고, 없으면 임원은 `/admin`, 승인된 회원은 `/forum/assembly`, 그 밖의 계정은 `/account`다.
- `safeAdminReturnTo`는 `/admin`, `/forum`, `/account` 경로만 허용하도록 넓힌다. 외부 주소와 `//`, 역슬래시를 거부하는 기존 검사는 그대로 유지한다.

### 7.5 헤더와 푸터

`/people`, `/about/*`, `/contact`, `/404`는 프리렌더 페이지이므로 Header가 서버에서 세션을 읽을 수 없다. 로그인 상태에 따른 링크는 클라이언트 스크립트가 `/api/auth/me`를 호출한 뒤 표시한다.

- 임원에게 "Directors Forum", "Assembly Forum", "Account"를 보여 준다.
- 승인된 회원에게 "Assembly Forum", "Account"를 보여 준다.
- 그 밖의 로그인 계정에게 "Account"를 보여 준다.
- 비로그인 사용자에게는 푸터에 정적인 "Sign in" 링크를 둔다. 헤더의 공개 내비게이션은 바꾸지 않는다.

### 7.6 `/account`

이름, 이메일, 소속, 상태를 보여 준다. 승인 대기이면 임원이 검토 중이라고 안내하고, 반려이면 승인되지 않았다는 사실과 사무국 연락처(`content.ts`의 기존 값)를 안내한다. 승인되었으면 총회 게시판 링크를 보여 준다. 화면 문구는 영어이고 `src/i18n`에 둔다.

## 8. Forum

### 8.1 이름과 경로

영어 UI에서 `board`는 이사회(Board of Directors)와 혼동되므로 사이트 안에서 게시판을 `forum`이라고 부른다. 화면 이름은 "Directors Forum"과 "Assembly Forum"이다.

| 경로                                 | 용도                           |
| ------------------------------------ | ------------------------------ |
| `/forum/directors`, `/forum/assembly` | 목록 (한 페이지 20건, 최신순)  |
| `/forum/[board]/new`                 | 글쓰기                         |
| `/forum/[board]/[id]`                | 상세. 수정·삭제 조작을 포함한다. |
| `POST /api/forum/[board]`            | 글 생성                        |
| `PUT /api/forum/[board]/[id]`        | 글 수정 (`expectedRevision`)   |
| `DELETE /api/forum/[board]/[id]`     | 글 숨김 (`expectedRevision`)   |

### 8.2 게시판별 허용 역할

게시판은 두 개뿐이므로 허용 역할은 DB가 아니라 코드의 상수 표로 둔다.

| 게시판      | 열람           | 작성           |
| ----------- | -------------- | -------------- |
| `directors` | 임원           | 임원           |
| `assembly`  | 임원, 회원     | 임원, 회원     |

### 8.3 동작 규칙

- 본문은 일반 텍스트이고 줄바꿈만 유지한다. 마크다운, HTML, 자동 링크는 쓰지 않는다. 화면에 출력할 때는 항상 이스케이프한다.
- 수정은 작성자 본인만 할 수 있다. 삭제는 작성자 본인과 임원이 할 수 있다. 삭제된 글은 목록과 상세에서 보이지 않는다.
- `expectedRevision`이 맞지 않으면 409를 반환하고, 화면은 다시 불러오라고 안내한다.
- 작성자 표시는 이름만 쓴다. 이메일은 forum 어디에도 노출하지 않는다. 표시 이름이 없는 기존 계정은 역할 이름("Officer" 또는 "Member")으로 표시한다.
- 알림(Discord, Telegram)은 보내지 않는다.
- 이번 범위에서 제외한다: 댓글, 첨부 파일, 검색, 상단 고정.

### 8.4 캐시와 색인 방지

모든 forum 응답과 `/admin/users`, `/api/users/**`, `/account`, `/login`, `/signup`, `/api/forum/**`에 `Cache-Control: no-store`와 `X-Robots-Tag: noindex`를 붙인다. 기존 미들웨어가 Q&A 경로에만 적용하던 보안 헤더 묶음을 이 경로들까지 넓힌다. forum 경로는 사이트맵에 넣지 않는다.

### 8.5 화면 톤

`PRODUCT.md`는 "소셜 피드와 커뮤니티 앱"을 반(反)레퍼런스로 정했다. 따라서 카드형 피드가 아니라 제목, 작성자, 날짜를 가진 기록형 목록으로 만든다. 목록은 기존 `PublicPagination`을 재사용한다. 접근성 기준은 WCAG 2.2 AA이며 폼은 레이블과 `role="alert"` 오류 안내를 갖춘다.

## 9. 임원용 사용자 관리

### 9.1 화면

`/admin/users`를 추가하고 어드민 메뉴에 "Users"를 넣는다. Q&A의 대기 건수 배지(`countAdminQuestions`)와 같은 방식으로 승인 대기 건수를 메뉴에 표시한다. 이 배지가 임원이 새 가입자를 알아채는 유일한 수단이다.

- 탭: 승인 대기, 승인 완료, 반려. 쿼리 `?status=`와 `?page=`를 쓰고 기존 `AdminPagination`을 재사용한다.
- 열: 이름, 이메일, 소속, 가입일, 역할, 결정한 임원과 결정 시각(승인 완료·반려 탭).
- 정렬: 승인 대기는 오래된 순, 나머지는 결정 시각의 최신순.
- 인증 메일이 아직 없으므로 모든 이메일은 미인증이다. 행마다 표시하지 않고 목록 위에 안내 문구 한 줄로 알린다. 임원은 이메일이 아니라 이름과 소속을 근거로 판단해야 한다.

### 9.2 API

`PATCH /api/users/[id]/status`는 본문 `{ status: 'approved' | 'rejected', expectedRevision }`을 받는다. `requireMutation(scope: 'users', require: 'officer')`로 보호한다. 4.3의 허용 전이만 처리하고, 허용되지 않는 전이와 `expectedRevision` 불일치는 409를 반환한다. 대상이 본인이거나 임원이면 403(`forbidden`)이다. 성공하면 `users`의 `status`, `revision`, `decided_by`, `decided_at` 갱신과 `user_audit_events` 기록을 같은 배치로 처리한다.

## 10. 배포와 이전 절차

### 10.1 1단계 배포는 동작을 바꾸지 않는다

운영 배포가 마이그레이션을 같은 파이프라인에서 자동 적용하므로(2.2), 마이그레이션과 역할 조정과 코드 배포를 수동으로 나눌 수 없다. 대신 1단계가 권한의 실질을 바꾸지 않게 설계한다.

- 마이그레이션 `0007`이 기존 계정을 모두 `officer`, `approved`로 만든다. 지금 이 계정들이 가진 권한과 같으므로 배포 직후에도 세미나 글, 미디어, Q&A 답변을 그대로 쓸 수 있다.
- 새 코드가 배포되기 전 잠깐 동안 기존 Worker가 새 컬럼을 무시하지만, 추가만 하는 마이그레이션이므로 호환된다.
- 1단계에는 임원 전용 내용(임원 게시판)과 승인 기능이 아직 없다. 그래서 임원 역할이 기존 권한 이상을 주지 않는다.

### 10.2 계정 명단 점검 (2단계 배포 전 필수)

임원 게시판이 열리면 임원 역할이 새로운 열람 권한을 갖게 되므로, 2단계를 운영에 배포하기 전에 다음을 수행한다.

1. 운영 D1의 계정 명단을 조회한다(`select username, display_name from users`). 이 명령은 읽기 전용이지만 운영 데이터를 읽으므로 사용자가 직접 실행하거나 명시적으로 승인한 뒤에 실행한다.
2. `src/data/members.json`의 직함과 대조한다. 현재 명단은 회장, 수석부회장, 이사 3명, 감사 1명, 수석고문 1명이다.
3. 임원이 아닌 계정(감사, 수석고문 등)이 있으면 `scripts/set-user-role.mjs`로 `member`로 바꾼다. 그 계정이 지금 가진 세미나·Q&A 쓰기 권한은 D7에 따라 사라진다는 점을 사용자에게 알린다.
4. 표시 이름이 비어 있는 임원 계정은 이름을 채운다.

### 10.3 스크립트 변경

- `scripts/create-user.mjs`는 새 기본값(`pending`) 때문에 그대로 두면 승인 대기 계정을 만든다. `--role officer|member`를 필수 인자로 받고 `status = approved`로 삽입하도록 바꾼다. 역할을 생략하면 오류로 끝나게 해서 의도하지 않은 권한 부여를 막는다.
- `scripts/set-user-role.mjs`를 새로 추가한다. 기존 `create-user.mjs`와 같은 방식으로 저장소 안의 `wrangler`를 직접 가리킨다.
- 해시 반복 횟수를 맞추는 `password-script-parity.test.ts`는 그대로 유지한다.

### 10.4 롤백

모든 마이그레이션이 추가만 하므로 Worker 롤백만으로 이전 버전이 동작한다. 데이터 복구가 필요하면 배포 요약에 남는 D1 Time Travel 북마크를 쓴다.

## 11. 보안과 개인정보

- 모든 변경 API는 세션, 동일 출처, `sec-fetch-site`, CSRF 토큰을 요구한다.
- 로그인 속도 제한과 동일 응답 정책은 유지한다. 가입 속도 제한과 봇 방어는 후속 절차다.
- 이메일은 개인정보다. 사용자 관리 화면과 감사 기록 외에는 어디에도 노출하지 않고, 로그와 감사 기록에도 남기지 않는다.
- 개인정보 처리방침 페이지가 없으므로(`MEMBERSHIP_FLOW.md`) 3단계를 배포하더라도 `SIGNUP_ENABLED`를 켜기 전에 처리방침과 수집 항목, 보관 기간, 처리 책임자를 확정해야 한다.
- 비공개 글이 캐시나 검색 엔진에 남지 않도록 8.4의 헤더를 적용한다.

## 12. 검증 계획

`AGENTS.md`에 따라 상태 전이, API, 권한 로직은 TDD로 구현하고, 완료를 주장하기 전에 `verification-before-completion`으로 새로 검증한다.

| 대상                  | 방법                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 권한 판정             | 4.2의 매트릭스를 역할, 상태, 게시판, 동작의 조합으로 옮긴 표 기반 단위 테스트                                                                |
| 경로 가드 누락 방지   | 6.4의 커버리지 테스트                                                                                                                        |
| 가드 동작             | 비로그인(401), 권한 없음(403), CSRF·출처 오류, `expectedRevision` 불일치(409)를 핸들러 단위로 확인                                           |
| 상태 전이             | 4.3의 허용 전이와 금지 전이(본인, 임원, 잘못된 순서)                                                                                         |
| DB 제약               | 기존 `test:qna:d1`과 같은 방식의 D1 테스트(길이 제한, 허용 값, 삭제 컬럼 일관성, 감사 기록의 리비전 규칙)                                    |
| 1단계 동작 보존       | 마이그레이션 후 기존 계정이 세미나 글, 미디어, Q&A 답변을 그대로 수행함을 확인하는 회귀 테스트                                               |
| 캐시·색인 헤더        | 미들웨어 테스트에 forum, 사용자 관리, 계정 경로를 추가                                                                                       |
| 화면                  | 기존 `npm run verify`(3폭 렌더), 접근성 `npm run a11y`에 새 화면 포함                                                                        |
| 기존 파이프라인       | `npm run check`, `npm test`, `npm run test:qna:d1`, `npm run verify:admin`                                                                   |

## 13. 구현 단계

명세서는 하나이고, 구현 계획(`writing-plans`)은 단계마다 따로 만든다. 각 단계는 독립적으로 배포할 수 있어야 한다.

| 단계 | 내용                                                                                                           | 배포 후 사용자에게 보이는 변화                           |
| ---- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | `0007` 마이그레이션, `getSessionUser`와 공용 가드, 교체 대상 11개, 커버리지 테스트, 스크립트 변경, 이전 회귀 테스트 | 없음 (동작 보존). `/api/auth/me` 응답에 필드가 추가된다. |
| 2    | `0008`, forum 엔진, 두 게시판 화면과 API, 헤더·푸터 링크, 캐시·색인 헤더                                        | 임원과 회원에게 forum 링크가 나타난다.                   |
| 3    | `0009`, `/login`, `/signup`, `/account`, `/admin/users`, `SIGNUP_ENABLED`                                       | `/login`, `/account`, `/admin/users`가 생긴다. 가입은 꺼진 상태다. |

2단계는 10.2의 계정 명단 점검을 마친 뒤 배포한다. 3단계의 가입 기능은 15장의 선행 조건을 모두 마친 뒤에만 켠다.

## 14. 같은 변경에서 개정할 문서

| 문서                     | 개정 내용                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IDEA.md`                | 59행의 "공개 회원가입은 제공하지 않는다"와 62행의 커뮤니티 경계를 개정한다. 회원 전용 forum이 "회원 콘텐츠 운영"에 해당함을 밝히고, Q&A 설명의 "사용자 계정을 두지 않는" 문구를 바로잡는다. |
| `PRODUCT.md`             | 사용자 절을 임원과 회원 구분으로 고친다. "소셜 피드 지양" 원칙은 유지하고 forum을 기록형 목록으로 만든다는 기준을 추가한다.                               |
| `CONTENT_ARCHITECTURE.md` | 라우트, 테이블, 권한·알림 절을 갱신하고 "권한 flat" 문장을 폐기한다.                                                                                     |
| `MEMBERSHIP_FLOW.md`     | 가입 경로를 외부 폼 안내에서 사이트 내 가입과 임원 승인 절차로 갱신하고, 가입이 켜지기 전 선행 조건을 유지한다.                                          |
| `docs/operations-runbook.md` | 역할 변경 스크립트와 계정 명단 점검 절차를 추가한다.                                                                                                 |
| `.env.example`           | `SIGNUP_ENABLED`를 추가한다.                                                                                                                             |
| `CHANGELOG.md`           | PR 직전에 `pr-changelog` 스킬로 날짜별 기록을 남긴다.                                                                                                    |

## 15. 후속 절차 (이번 범위 밖)

| 항목                                                                  | 이번 단계의 임시 처리                                                         | 선행 조건 여부                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------- |
| 인증 메일 발송과 이메일 소유 인증                                     | 모든 이메일이 미인증이다. 사용자 관리 화면에 안내 문구를 둔다.               | 가입 공개 전에 권장                    |
| 비밀번호 재설정                                                       | 운영자가 스크립트로 새 비밀번호를 발급하고 기존 세션을 폐기한다(`revokeUserSessions`). | 가입 공개 전에 권장                    |
| 스팸·남용 방어(Turnstile, 가입 속도 제한, 계정 열거 방지, 미승인 계정 정리) | `SIGNUP_ENABLED`를 끈 채로 둔다.                                           | **가입 공개의 필수 선행 조건**         |
| 개인정보 처리방침                                                     | 없음                                                                          | **가입 공개의 필수 선행 조건**         |
| 승인 결과 이메일, 새 가입자 Discord·Telegram 알림                     | 임원은 대기 건수 배지로, 가입자는 `/account`로 확인한다.                      | 아니오                                 |
| 회원 제명·승인 취소, 임원 역할 부여 화면                              | 운영자가 DB와 스크립트로 처리한다.                                            | 아니오                                 |
| forum 댓글, 첨부, 검색, 상단 고정, 서식 있는 본문                     | 제공하지 않는다.                                                              | 아니오                                 |

## 16. 알려진 한계와 위험

- **이메일 미인증:** 다른 사람의 이메일로 가입할 수 있다. 임원이 이름과 소속으로 판단해야 하고, 인증 메일이 나가기 전까지는 시스템이 이를 막지 못한다.
- **계정 열거:** 가입 시 `email_taken` 응답으로 이메일 가입 여부가 드러난다. 가입이 꺼진 동안에는 노출되지 않는다.
- **단독 승인:** 임원 1명의 결정으로 회원이 되므로 정관의 이사회 의결과 다르다. 감사 기록으로 책임을 추적하고, 의결 자체는 사이트 밖의 조직 절차로 둔다.
- **가드 누락:** 커버리지 테스트는 호출 문자열을 확인할 뿐이다. 매트릭스 테스트와 핸들러 단위 테스트가 이를 보완한다.
- **임원 계정 점검 의존:** 감사·수석고문 계정이 임원으로 이전되는 위험은 10.2의 절차에 의존한다. 이 절차는 사람이 수행한다.

## 17. 검토 시 확인할 기본값

설계 승인 때 직접 다루지 않았고 명세서를 쓰면서 제가 정한 값이다. 바꾸고 싶으면 이 목록에서 지적한다.

1. 비밀번호는 10~128자이고 이메일과 같은 값을 금지한다. 이름은 1~100자, 소속은 200자 이하다.
2. 가입 직후 자동으로 로그인시키고 `/account`로 보낸다.
3. forum 목록과 사용자 관리 목록의 페이지 크기는 Q&A와 같은 20이다.
4. 로그인 후 기본 이동 경로는 임원 `/admin`, 승인된 회원 `/forum/assembly`, 그 밖의 계정 `/account`다.
5. 표시 이름이 없는 계정은 "Officer" 또는 "Member"로 표시한다.
6. `SIGNUP_ENABLED`는 Workers 변수이고 값이 정확히 `true`일 때만 켜진다. 켜려면 설정 변경과 배포가 필요하다.
7. 비로그인 사용자의 "Sign in" 링크는 헤더가 아니라 푸터에 둔다. 로그인 상태에 따른 헤더 링크는 클라이언트 스크립트로 표시한다.
8. 감사 기록의 동작 이름은 `approved`, `rejected`, `reapproved`다. 권한 부족 응답은 403 `forbidden`이다.
9. forum 본문은 일반 텍스트이고 자동 링크를 만들지 않는다.
