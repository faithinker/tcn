import { describe, expect, it } from 'vitest';

import { formatDate } from './utils';

// 영어 단일 사이트 — 날짜는 Date 객체 없이 결정적으로 포맷한다.
describe('formatDate', () => {
  it('renders English dates from ISO date or timestamp', () => {
    expect(formatDate('2026-10-30')).toBe('October 30, 2026');
    expect(formatDate('2025-12-26T00:00:00Z')).toBe('December 26, 2025');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
