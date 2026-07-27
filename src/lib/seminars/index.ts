// 이 barrel은 순수(isomorphic) 모듈만 내보낸다 — 클라이언트 컴포넌트(React island)가
// 안전하게 import 할 수 있어야 한다. service.ts는 db/client('cloudflare:workers')를
// 끌어오므로 여기서 재수출하면 브라우저 하이드레이션이 깨진다(실제 발생, verify:admin이 검출).
// 서버 코드는 './seminars/service'를 직접 import 한다.
export * from './model';
export * from './url';
export * from './validation';
