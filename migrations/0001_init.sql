-- TCN 세미나 CMS — 초기 스키마 (Cloudflare D1 / SQLite)
-- 테이블 3개: users, posts, media
--  · 권한 없음: 인증만 통과하면 누구나 CRUD
--  · soft delete: posts.deleted_at 로 숨김 (실삭제 안 함)
--  · 영어 단일 언어, 본문은 마크다운

-- 회원: 회원가입 UI 없음. 계정은 스크립트로 수동 발급(평문 비번 → PBKDF2 해시 저장).
create table users (
  id            text primary key,               -- uuid
  username      text not null unique,            -- 로그인 아이디
  password_hash text not null,                   -- PBKDF2 해시 (평문 저장 금지)
  display_name  text,
  created_at    integer not null default (unixepoch())
);

-- 세미나 글: 이벤트 정보 + 본문을 한 행에 통합.
create table posts (
  id            text primary key,                -- uuid
  title         text not null,
  summary       text,                            -- 선택값
  event_date    text,                            -- 개최일 (YYYY-MM-DD)
  address       text,
  body          text not null default '',        -- 본문 (마크다운)
  hero_media_id text,                            -- 대표 이미지 media.id (선택, 소프트 참조)
  author_id     text references users(id) on delete set null,
  created_at    integer not null default (unixepoch()),
  updated_at    integer not null default (unixepoch()),
  deleted_at    integer                          -- soft delete (null = 노출)
);

-- 미디어: 사진/영상/문서. 파일 본체는 R2, 여기엔 메타데이터 + R2 키만.
create table media (
  id         text primary key,                   -- uuid
  post_id    text not null references posts(id) on delete cascade,
  r2_key     text not null unique,               -- R2 객체 키
  kind       text not null check (kind in ('image', 'video', 'document')),
  mime_type  text,                               -- application/pdf, ...spreadsheetml.sheet 등
  filename   text,                               -- 원본 파일명 (확장자 포함, 다운로드용)
  size       integer,                            -- 바이트
  width      integer,                            -- 이미지/영상
  height     integer,
  duration   integer,                            -- 영상 길이(초), 선택
  position   integer not null default 0,         -- 갤러리 정렬 순서
  caption    text,
  created_at integer not null default (unixepoch())
);

create index posts_visible_idx on posts (deleted_at, event_date);
create index media_post_idx     on media (post_id, position);
