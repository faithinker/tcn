-- 초 단위 updated_at만으로는 동시 저장을 구분하기 어려워 명시적 revision을 사용한다.
alter table posts add column revision integer not null default 1;
