// L3: i18n 헬퍼 — URL에서 언어 판별, 번역 함수, 경로 지역화.
// 라우팅: ko는 prefix 없음('/about'), en은 '/en/' prefix('/en/about').

import { ui, defaultLang, type UiLang, type UiKey } from './ui';

/** URL 경로 첫 세그먼트로 언어 판별. 미매치 시 기본(ko). */
export function getLangFromUrl(url: URL): UiLang {
  const [, seg] = url.pathname.split('/');
  if (seg in ui) return seg as UiLang;
  return defaultLang;
}

/** 해당 언어의 번역 함수 반환. 키 누락 시 기본 언어로 폴백. */
export function useTranslations(lang: UiLang) {
  return function t(key: UiKey): string {
    return ui[lang][key] ?? ui[defaultLang][key];
  };
}

/**
 * 언어에 맞는 경로 생성.
 * ko: 그대로('/about'), en: '/en' prefix('/en/about'). 루트는 '/' / '/en/'.
 */
export function localizePath(path: string, lang: UiLang): string {
  const clean = '/' + path.replace(/^\/+/, '');
  if (lang === defaultLang) return clean;
  return clean === '/' ? `/${lang}/` : `/${lang}${clean}`;
}

/** 현재 경로에서 언어 prefix 제거 → 기준 경로('/about', 루트는 '/'). */
export function stripLangPrefix(pathname: string): string {
  const parts = pathname.split('/');
  if (parts[1] && parts[1] in ui && parts[1] !== defaultLang) {
    const rest = '/' + parts.slice(2).join('/');
    return rest === '/' ? '/' : rest.replace(/\/$/, '');
  }
  return pathname === '/' ? '/' : pathname.replace(/\/$/, '');
}

/** 언어 전환용: 현재 기준 경로를 대상 언어 경로로 변환. */
export function switchLangPath(currentPath: string, toLang: UiLang): string {
  return localizePath(stripLangPrefix(currentPath), toLang);
}

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** ISO 날짜(YYYY-MM-DD)를 언어별 표기로. Date 객체 미사용(빌드 결정성). */
export function formatDate(iso: string, lang: UiLang = defaultLang): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return lang === 'en' ? `${EN_MONTHS[m - 1]} ${d}, ${y}` : `${y}년 ${m}월 ${d}일`;
}
