import { describe, expect, it } from 'vitest';

import { formatDate } from './utils';

describe('formatDate', () => {
  it('formats a complete ISO date', () => {
    expect(formatDate('2025-12-12')).toBe('December 12, 2025');
  });

  it('formats an approximate month without inventing a day', () => {
    expect(formatDate('2025-06')).toBe('June 2025');
  });
});
