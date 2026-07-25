import { describe, expect, it } from 'vitest';

import { selectHomeSeminars } from './selectors';
import type { PublicContentSnapshot, PublicSeminar } from './types';

const seminar = (overrides: Partial<PublicSeminar>): PublicSeminar => ({
  id: 'seminar',
  sequence: 1,
  locale: 'ko',
  title: '세미나',
  startsAt: '2026-01-01',
  eventStatus: 'scheduled',
  temporalStatus: 'upcoming',
  placeName: '서울',
  ...overrides,
});

describe('selectHomeSeminars', () => {
  it('selects the earliest upcoming seminar and newest past seminar for one locale', () => {
    const snapshot: PublicContentSnapshot = {
      source: 'supabase',
      seminars: [
        seminar({ id: 'future-later', sequence: 4, startsAt: '2027-02-01' }),
        seminar({ id: 'past-new', sequence: 3, startsAt: '2026-02-01', temporalStatus: 'past' }),
        seminar({ id: 'future-next', sequence: 5, startsAt: '2026-10-01' }),
        seminar({ id: 'past-old', sequence: 2, startsAt: '2025-02-01', temporalStatus: 'past' }),
        seminar({ id: 'english', locale: 'en', startsAt: '2026-03-01' }),
      ],
      posts: [],
      aliases: [],
      history: [],
    };

    expect(selectHomeSeminars(snapshot, 'ko')).toEqual({
      next: expect.objectContaining({ id: 'future-next' }),
      featured: expect.objectContaining({ id: 'past-new' }),
    });
  });

  it('does not duplicate the next seminar when no past seminar exists', () => {
    const snapshot: PublicContentSnapshot = {
      source: 'json',
      seminars: [
        seminar({ id: 'next', sequence: 1, startsAt: '2026-10-01' }),
        seminar({ id: 'later', sequence: 2, startsAt: '2027-10-01' }),
      ],
      posts: [],
      aliases: [],
      history: [],
    };

    expect(selectHomeSeminars(snapshot, 'ko')).toEqual({
      next: expect.objectContaining({ id: 'next' }),
      featured: expect.objectContaining({ id: 'later' }),
    });
  });
});
