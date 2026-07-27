import { describe, expect, it } from 'vitest';

import { isSeminarDateConflictError, validateSeminarDate } from './validation';

describe('validateSeminarDate', () => {
  it('requires an event date for a seminar post', () => {
    expect(validateSeminarDate({ eventDate: '', existingDates: [] })).toBe('event_date_required');
  });

  it('rejects a malformed or impossible calendar date', () => {
    expect(validateSeminarDate({ eventDate: '2026-02-31', existingDates: [] })).toBe(
      'event_date_invalid',
    );
  });

  it('rejects a date already used by another visible seminar', () => {
    expect(
      validateSeminarDate({
        eventDate: '2026-10-30',
        existingDates: ['2025-12-26', '2026-10-30'],
      }),
    ).toBe('event_date_conflict');
  });

  it('allows a new seminar only after the latest existing event date', () => {
    const existingDates = ['2025-12-26', '2026-10-30'];

    expect(validateSeminarDate({ eventDate: '2026-08-01', existingDates })).toBe(
      'event_date_must_follow_latest',
    );
    expect(validateSeminarDate({ eventDate: '2027-04-16', existingDates })).toBeNull();
  });

  it('keeps an existing public event date immutable while allowing normal content edits', () => {
    const input = {
      existingDates: ['2025-12-26', '2026-10-30'],
      currentEventDate: '2025-12-26',
    };

    expect(validateSeminarDate({ ...input, eventDate: '2025-12-26' })).toBeNull();
    expect(validateSeminarDate({ ...input, eventDate: '2025-12-27' })).toBe('event_date_immutable');
  });
});

describe('isSeminarDateConflictError', () => {
  it('recognizes both the named index and SQLite column constraint messages', () => {
    expect(
      isSeminarDateConflictError(
        new Error('UNIQUE constraint failed: index posts_visible_event_date_unique'),
      ),
    ).toBe(true);
    expect(
      isSeminarDateConflictError(new Error('UNIQUE constraint failed: posts.event_date')),
    ).toBe(true);
  });

  it('does not hide unrelated database failures as date conflicts', () => {
    expect(isSeminarDateConflictError(new Error('database is locked'))).toBe(false);
    expect(isSeminarDateConflictError('posts_visible_event_date_unique')).toBe(false);
  });
});
