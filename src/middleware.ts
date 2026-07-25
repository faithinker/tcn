import { defineMiddleware } from 'astro:middleware';

// i18n 수동 라우팅: 공개 콘텐츠는 실제 /ko·/en 페이지가 담당하고,
// 관리자 앱은 언어 접두사 없는 /admin 경로를 그대로 사용한다.
export const onRequest = defineMiddleware((_context, next) => next());
