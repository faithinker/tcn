import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adminDraftKey,
  adjustWaitingCount,
  formatWaitingAge,
  validateAnswerDraft,
} from '../../scripts/admin-qna-utils';

const detailPage = readFileSync(
  new URL('../../pages/admin/questions/[id].astro', import.meta.url),
  'utf8',
);

describe('admin Q&A UI helpers', () => {
  it.each([
    [4, -1, 3],
    [4, 1, 5],
    [0, -1, 0],
  ])('adjusts the header waiting count without going negative', (current, delta, expected) => {
    expect(adjustWaitingCount(current, delta)).toBe(expected);
  });

  it('does not serialize Astro template indentation into the answer textarea', () => {
    const textarea = detailPage.match(
      /<textarea[\s\S]*?id="official-answer"[\s\S]*?(?:\/>|<\/textarea>)/,
    )?.[0];

    expect(textarea).toBeDefined();
    expect(textarea).toContain("set:text={question.answer?.body ?? ''}");
    expect(textarea).not.toMatch(/>\s+\{question\.answer\?\.body/);
  });

  it('scopes answer drafts to one question', () => {
    expect(adminDraftKey('question-42')).toBe('tcn:qna:answer-draft:question-42');
  });

  it.each([
    ['', 'Enter an official answer.'],
    ['   \n', 'Enter an official answer.'],
    ['a'.repeat(10_001), 'Keep the official answer to 10,000 characters or fewer.'],
    ['A plain-text answer.', null],
  ])('validates answer draft boundaries', (draft, expected) => {
    expect(validateAnswerDraft(draft)).toBe(expected);
  });

  it.each([
    ['2026-07-29T03:00:00.000Z', 'Today'],
    ['2026-07-28T03:00:00.000Z', '1 day waiting'],
    ['2026-07-17T03:00:00.000Z', '12 days waiting'],
  ])('formats waiting age from calendar days', (createdAt, expected) => {
    expect(formatWaitingAge(createdAt, new Date('2026-07-29T12:00:00.000Z'))).toBe(expected);
  });

  it('does not show a negative age for a future timestamp', () => {
    expect(formatWaitingAge('2026-07-30T03:00:00.000Z', new Date('2026-07-29T12:00:00.000Z'))).toBe(
      'Today',
    );
  });
});
