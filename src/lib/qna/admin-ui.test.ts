import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const detailPage = readFileSync(
  new URL('../../pages/admin/questions/[id].astro', import.meta.url),
  'utf8',
);

describe('admin Q&A UI helpers', () => {
  it('does not serialize Astro template indentation into the answer textarea', () => {
    const textarea = detailPage.match(
      /<textarea[\s\S]*?id="official-answer"[\s\S]*?(?:\/>|<\/textarea>)/,
    )?.[0];

    expect(textarea).toBeDefined();
    expect(textarea).toContain("set:text={question.answer?.body ?? ''}");
    expect(textarea).not.toMatch(/>\s+\{question\.answer\?\.body/);
  });
});
