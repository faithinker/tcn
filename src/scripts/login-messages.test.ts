import { describe, expect, it } from 'vitest';
import { lockedMessage, waitDescription } from './login-messages';

describe('waitDescription', () => {
  it('rounds up to whole minutes below an hour', () => {
    expect(waitDescription('900')).toBe('15 minutes');
    expect(waitDescription('61')).toBe('2 minutes');
    expect(waitDescription('1')).toBe('1 minute');
  });

  it('rounds up to whole hours from one hour', () => {
    expect(waitDescription('3600')).toBe('1 hour');
    expect(waitDescription('14400')).toBe('4 hours');
    expect(waitDescription('86400')).toBe('24 hours');
    expect(waitDescription('3601')).toBe('2 hours');
  });

  it('falls back to a generic phrase when the header is missing or unusable', () => {
    expect(waitDescription(null)).toBe('a while');
    expect(waitDescription('')).toBe('a while');
    expect(waitDescription('soon')).toBe('a while');
    expect(waitDescription('0')).toBe('a while');
    expect(waitDescription('-5')).toBe('a while');
  });
});

describe('lockedMessage', () => {
  it('tells the user how long to wait', () => {
    expect(lockedMessage('3600')).toBe('Too many sign-in attempts. Try again in 1 hour.');
  });
});
