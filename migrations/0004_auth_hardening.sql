-- 세션 버전은 로그아웃/계정 보안 조치 시 기존 서명 토큰을 즉시 폐기한다.
alter table users add column session_version integer not null default 1;

-- 로그인 실패는 원문 IP/아이디 대신 SHA-256 식별자로 저장한다.
create table auth_rate_limits (
  identifier        text primary key,
  attempts          integer not null default 0,
  window_started_at integer not null,
  blocked_until     integer not null default 0,
  updated_at        integer not null
);

create index auth_rate_limits_updated_idx on auth_rate_limits (updated_at);
