-- 로그인 잠금 단계 상승: 잠금을 다시 얻을 때마다 길어진다(15분, 1시간, 4시간, 24시간 상한).
-- lock_count 는 지금까지 건 잠금 횟수다. additive 변경이라 이전 버전 Worker 는 이 컬럼을 무시한다.
alter table auth_rate_limits add column lock_count integer not null default 0;
