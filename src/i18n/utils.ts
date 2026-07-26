// 영어 단일 사이트 — 남은 i18n 헬퍼는 날짜 포맷 하나뿐이다.
// UI 문자열은 i18n/ui.ts의 t(), 페이지 카피는 i18n/content.ts에서 바로 가져온다.
// 구 /ko·/en 프리픽스 회수는 public/_redirects의 301 규칙이 엣지에서 처리한다.

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** ISO 날짜의 날짜 부분을 영어 표기로. Date 객체 미사용(빌드 결정성). */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return iso;
  return `${EN_MONTHS[m - 1]} ${d}, ${y}`;
}
