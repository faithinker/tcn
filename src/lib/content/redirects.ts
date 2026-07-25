// 정적 배포에서 DB 기반 URL 별칭을 진짜 HTTP 301로 승격.
// [...alias].astro의 프리렌더 redirect는 meta-refresh(200)로 서빙되므로,
// 빌드 종료 후 dist/_redirects에 생성 섹션을 병합해 Cloudflare가 301을 내게 한다.
import { buildCanonicalAliases } from './routes';
import type { PublicContentSnapshot } from './types';

const BEGIN_MARKER = '# BEGIN content-aliases (generated)';
const END_MARKER = '# END content-aliases';

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/** 스냅샷의 별칭(DB aliases + legacySlug) → Cloudflare `_redirects` 301 라인. */
export function buildRedirectLines(snapshot: PublicContentSnapshot): string[] {
  return buildCanonicalAliases(snapshot).map(
    (alias) => `${alias.from} ${withTrailingSlash(alias.to)} 301`,
  );
}

function stripGeneratedSection(content: string): string {
  const begin = content.indexOf(BEGIN_MARKER);
  if (begin === -1) return content;
  const end = content.indexOf(END_MARKER, begin);
  const tail = end === -1 ? '' : content.slice(end + END_MARKER.length);
  return `${content.slice(0, begin)}${tail.replace(/^\n+/, '')}`.replace(/\n+$/, '\n');
}

function sourcePathsOf(content: string): Set<string> {
  const sources = new Set<string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    sources.add(trimmed.split(/\s+/)[0]);
  }
  return sources;
}

/**
 * 손으로 관리하는 `_redirects` 내용에 생성 섹션을 병합한다.
 * - 파일이 이미 처리하는 source 경로는 건너뜀 (중복 규칙 방지)
 * - 마커 사이 섹션만 교체하므로 반복 실행에 멱등
 * - 남는 생성 라인이 없으면 섹션 자체를 제거
 */
export function mergeRedirectsFile(existing: string, lines: string[]): string {
  const base = stripGeneratedSection(existing);
  const handled = sourcePathsOf(base);
  const fresh = lines.filter((line) => !handled.has(line.split(/\s+/)[0]));

  if (fresh.length === 0) return base;

  const body = base.replace(/\n+$/, '');
  return `${body}\n\n${BEGIN_MARKER}\n${fresh.join('\n')}\n${END_MARKER}\n`;
}
