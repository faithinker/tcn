// 의존성 없는 SQL 조각. Worker(db/posts.ts)와 빌드 타임 내보내기 스크립트
// (scripts/export-public-content.mjs, Node에서 직접 실행)가 같은 문장을 쓰게 한다 —
// 정적 페이지가 보는 세미나 목록이 SSR 시절과 한 글자도 어긋나지 않아야 하므로.
// cloudflare:workers 같은 런타임 전용 import를 이 파일에 넣지 말 것.

export const POST_COLUMNS = `id, title, summary, event_date as eventDate, address, body,
  hero_media_id as heroMediaId, author_id as authorId,
  revision, created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt`;

export const SEMINAR_POSTS_SQL = `select ${POST_COLUMNS} from posts
       where event_date is not null and deleted_at is null
       order by event_date asc, created_at asc`;
