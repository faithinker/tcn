import { describe, expect, it } from 'vitest';
import { failureMessage, waitDescription } from './login-messages';

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

describe('failureMessage', () => {
  it('tells a locked-out user how long to wait', () => {
    expect(failureMessage(429, '900')).toContain('15 minutes');
  });

  it('gives each server answer its own message', () => {
    const answers = [401, 403, 429, 503].map((status) => failureMessage(status, '900'));

    expect(new Set(answers).size).toBe(answers.length);
  });

  it('treats an unknown status like a credential failure rather than leaking detail', () => {
    expect(failureMessage(400, null)).toBe(failureMessage(401, null));
    expect(failureMessage(500, null)).toBe(failureMessage(401, null));
  });
});
