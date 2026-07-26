import { describe, expect, it } from 'vitest';
import { parsePostPayload, POST_LIMITS } from './post-payload';

describe('parsePostPayload', () => {
  const valid = {
    title: '  Seminar title  ',
    summary: '  Summary  ',
    eventDate: '2026-10-30',
    address: '  Seoul  ',
    body: 'Body',
    heroMediaId: null,
    revision: 3,
  };

  it('normalizes a valid post payload', () => {
    expect(parsePostPayload(valid)).toEqual({
      ok: true,
      value: {
        title: 'Seminar title',
        summary: 'Summary',
        eventDate: '2026-10-30',
        address: 'Seoul',
        body: 'Body',
        heroMediaId: null,
        revision: 3,
      },
    });
  });

  it.each([
    [null, 'invalid_payload'],
    [{ ...valid, title: 1 }, 'invalid_title'],
    [{ ...valid, summary: [] }, 'invalid_summary'],
    [{ ...valid, eventDate: 20261030 }, 'invalid_event_date'],
    [{ ...valid, heroMediaId: {} }, 'invalid_hero_media_id'],
    [{ ...valid, revision: 0 }, 'invalid_revision'],
  ])('rejects malformed input %#', (input, error) => {
    expect(parsePostPayload(input)).toEqual({ ok: false, error });
  });

  it.each([
    ['title', POST_LIMITS.title + 1, 'title_too_long'],
    ['summary', POST_LIMITS.summary + 1, 'summary_too_long'],
    ['address', POST_LIMITS.address + 1, 'address_too_long'],
    ['body', POST_LIMITS.body + 1, 'body_too_long'],
  ] as const)('rejects %s beyond its documented limit', (field, length, error) => {
    expect(parsePostPayload({ ...valid, [field]: 'x'.repeat(length) })).toEqual({
      ok: false,
      error,
    });
  });
});
