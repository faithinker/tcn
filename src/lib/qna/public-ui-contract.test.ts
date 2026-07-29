import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const publicSources = [
  'src/pages/questions/index.astro',
  'src/pages/questions/[id].astro',
  'src/pages/questions/new.astro',
  'src/components/qna/PublicPagination.astro',
  'src/components/qna/PublicStatusBadge.astro',
].map((path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));

describe('public Q&A UI contract', () => {
  it('renders user content only through escaped text contexts', () => {
    const source = publicSources.join('\n');
    expect(source).not.toMatch(/set:html|innerHTML|dangerouslySetInnerHTML/);
    expect(source).toContain('whitespace-pre-wrap');
  });

  it('keeps list filters and pagination in the URL with accessible targets', () => {
    const list = publicSources[0];
    const pagination = publicSources[3];
    expect(list).toContain('parsePublicStatus');
    expect(list).toContain('requestedPage > result.totalPages');
    expect(pagination).toContain("query.set('status', status)");
    expect(pagination).toContain("query.set('page', String(targetPage))");
    expect(pagination).toContain('min-h-12');
  });

  it('preserves drafts while handling create errors and redirects to the success detail', () => {
    const form = publicSources[2];
    expect(form).toContain('data-action="qna_question"');
    expect(form).toContain('status === 413');
    expect(form).toContain('status === 429');
    expect(form).toContain('Network unavailable. Your draft has been preserved.');
    expect(form).toContain('?created=1');
    expect(form).not.toContain('.reset()');
  });
});
