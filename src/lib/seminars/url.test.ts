import { describe, expect, it } from 'vitest';

import { seminarHref } from './url';

describe('seminarHref', () => {
  it('builds the public seminar URL from its event date', () => {
    expect(seminarHref('2025-12-26')).toBe('/seminars/2025-12-26');
  });

  it('does not build a public detail URL without a valid event date', () => {
    expect(seminarHref(null)).toBeNull();
    expect(seminarHref('not-a-date')).toBeNull();
    expect(seminarHref('2026-13-01')).toBeNull();
    expect(seminarHref('2026-02-31')).toBeNull();
  });
});
