-- Public seminar URLs use event_date, so visible dated posts must not collide.
create unique index if not exists posts_visible_event_date_unique
  on posts (event_date)
  where event_date is not null and deleted_at is null;
