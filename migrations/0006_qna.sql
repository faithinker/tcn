-- Public Q&A: plain-text questions, one official answer, soft visibility,
-- optimistic revisions, privacy-minimal audit records, and abuse controls.
create table qna_questions (
  id              text primary key,
  title           text not null
                    check (length(trim(title)) between 1 and 120)
                    check (instr(title, char(0)) = 0),
  body            text not null
                    check (length(trim(body)) between 1 and 10000)
                    check (instr(body, char(0)) = 0),
  asker_user_id   text references users(id) on delete set null,
  visibility      text not null default 'visible'
                    check (visibility in ('visible', 'hidden')),
  revision        integer not null default 1 check (revision >= 1),
  created_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table qna_answers (
  question_id     text primary key references qna_questions(id) on delete cascade,
  body            text not null
                    check (length(trim(body)) between 1 and 10000)
                    check (instr(body, char(0)) = 0),
  answered_by     text not null references users(id),
  revision        integer not null default 1 check (revision >= 1),
  created_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table qna_audit_events (
  id                text primary key,
  question_id       text not null references qna_questions(id),
  target_kind       text not null check (target_kind in ('question', 'answer')),
  target_id         text not null,
  actor_user_id     text not null references users(id),
  action            text not null
                      check (action in (
                        'answer_created', 'answer_updated',
                        'question_hidden', 'question_restored'
                      )),
  result            text not null default 'success' check (result = 'success'),
  before_revision   integer not null check (before_revision >= 0),
  after_revision    integer not null check (after_revision = before_revision + 1),
  request_id        text not null unique,
  created_at        text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (target_kind, target_id, before_revision)
);

-- One atomic UPSERT maintains both windows for a HMAC-derived client key.
create table qna_rate_limits (
  identifier              text primary key,
  short_window_started_at integer not null,
  short_attempts          integer not null check (short_attempts >= 0),
  day_window_started_at   integer not null,
  day_attempts            integer not null check (day_attempts >= 0),
  updated_at              integer not null
);

-- Siteverify tokens are single-use; a digest is retained only through the token TTL.
create table qna_turnstile_tokens (
  token_hash  text primary key,
  expires_at  integer not null,
  created_at  integer not null
);

create index qna_visible_created
  on qna_questions (visibility, created_at desc, id desc);
create index qna_admin_created
  on qna_questions (visibility, created_at asc, id asc);
create unique index qna_answer_question on qna_answers (question_id);
create index qna_audit_question_created
  on qna_audit_events (question_id, created_at desc);
create index qna_rate_limits_updated on qna_rate_limits (updated_at);
create index qna_turnstile_expiry on qna_turnstile_tokens (expires_at);
