import { describe, expect, it } from 'vitest';
import {
  adjustWaitingCount,
  adminDraftKey,
  formatWaitingAge,
  validateAnswerDraft,
} from './admin-qna-utils';

describe('admin Q&A browser utilities', () => {
  it('builds a question-scoped draft key', () => {
    expect(adminDraftKey('q-17')).toBe('tcn:qna:answer-draft:q-17');
  });

  it('validates blank, oversized and valid answers', () => {
    expect(validateAnswerDraft('   ')).toBe('Enter an official answer.');
    expect(validateAnswerDraft('x'.repeat(10_001))).toBe(
      'Keep the official answer to 10,000 characters or fewer.',
    );
    expect(validateAnswerDraft(' Answer ')).toBeNull();
  });

  it('never lets the waiting count become negative', () => {
    expect(adjustWaitingCount(2, -1)).toBe(1);
    expect(adjustWaitingCount(0, -1)).toBe(0);
  });

  it('formats waiting age by UTC calendar-day boundaries', () => {
    const now = new Date('2026-08-13T00:01:00.000Z');

    expect(formatWaitingAge('2026-08-13T23:59:00+09:00', now)).toBe('Today');
    expect(formatWaitingAge('2026-08-12T23:59:00.000Z', now)).toBe('1 day waiting');
    expect(formatWaitingAge('2026-08-10T12:00:00.000Z', now)).toBe('3 days waiting');
    expect(formatWaitingAge('invalid', now)).toBe('Awaiting answer');
  });

  it('clamps future timestamps to today', () => {
    expect(formatWaitingAge('2026-08-14T00:00:00.000Z', new Date('2026-08-13T00:00:00.000Z'))).toBe(
      'Today',
    );
  });
});
