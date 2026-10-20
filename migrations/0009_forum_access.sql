alter table users add column can_access_directors_forum integer not null default 0
  check (can_access_directors_forum in (0, 1));

create table forum_posts (
  id text primary key,
  board text not null check (board in ('directors', 'assembly')),
  title text not null check (length(trim(title)) between 1 and 120) check (instr(title, char(0)) = 0),
  body text not null check (length(trim(body)) between 1 and 10000) check (instr(body, char(0)) = 0),
  author_id text not null references users(id),
  revision integer not null default 1 check (revision >= 1),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at text,
  deleted_by text references users(id),
  check ((deleted_at is null) = (deleted_by is null))
);
create index forum_board_created on forum_posts (board, deleted_at, created_at desc, id desc);
