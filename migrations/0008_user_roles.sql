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
