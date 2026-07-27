import { describe, expect, it } from 'vitest';

import { formatDate } from './utils';

describe('formatDate', () => {
  it('renders English dates from ISO date or timestamp', () => {
    expect(formatDate('2026-10-30')).toBe('October 30, 2026');
    expect(formatDate('2025-12-26T00:00:00Z')).toBe('December 26, 2025');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
