import type { APIRoute } from 'astro';

// 프로세스가 요청에 응답할 수 있는지만 확인하는 liveness 엔드포인트.
// 외부 의존성은 /api/ready에서 별도로 확인한다.
export const prerender = false;

export const GET: APIRoute = () => Response.json({ ok: true });
