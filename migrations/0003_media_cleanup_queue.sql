-- R2와 D1은 단일 트랜잭션을 공유할 수 없으므로 삭제할 객체를 먼저 D1에 기록한다.
-- R2 삭제가 실패해도 공개 media 행은 제거되고, 운영 cleanup 작업이 안전하게 재시도한다.
create table media_cleanup_queue (
  r2_key       text primary key,
  attempts     integer not null default 0,
  last_error   text,
  created_at   integer not null default (unixepoch()),
  updated_at   integer not null default (unixepoch())
);

create index media_cleanup_created_idx on media_cleanup_queue (created_at);
