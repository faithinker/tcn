// 8단계: 영어 단일 사이트 — i18n 헬퍼를 단일 언어 호환 심(shim)으로 축소.
// 기존 소비 파일(레이아웃·템플릿)의 API 시그니처는 유지하되 언어는 항상 'en',
// 경로는 프리픽스 없는 루트 트리를 가리킨다.

import { ui, defaultLang, type UiLang, type UiKey } from './ui';

/** 영어 단일 사이트 — 항상 'en'. (시그니처 호환용으로 URL 인자는 무시) */
export function getLangFromUrl(_url?: URL): UiLang {
  return defaultLang;
}

/** 번역 함수 — 영어 카피 고정. */
export function useTranslations(_lang?: UiLang) {
  return function t(key: UiKey): string {
    return ui[defaultLang][key];
  };
}

/** 프리픽스 없는 루트 경로. ('/about' → '/about', '/' → '/') */
export function localizePath(path: string, _lang?: UiLang): string {
  const clean = '/' + path.replace(/^\/+/, '');
  return clean;
}

// 구 /ko·/en 프리픽스 회수는 public/_redirects의 301 규칙이 엣지에서 처리한다.

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** ISO 날짜의 날짜 부분을 영어 표기로. Date 객체 미사용(빌드 결정성). */
export function formatDate(iso: string, _lang: UiLang = defaultLang): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return iso;
  return `${EN_MONTHS[m - 1]} ${d}, ${y}`;
}
