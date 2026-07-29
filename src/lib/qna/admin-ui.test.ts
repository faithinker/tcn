import { describe, expect, it } from 'vitest';
import {
  adminDraftKey,
  formatWaitingAge,
  validateAnswerDraft,
} from '../../scripts/admin-qna-utils';

describe('admin Q&A UI helpers', () => {
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
