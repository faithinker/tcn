import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_PENDING_MESSAGE,
  failureMessage,
  lockedMessage,
  waitDescription,
} from './login-messages';

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

describe('failureMessage', () => {
  it('maps each server answer to a distinct, actionable message', () => {
    expect(failureMessage(401, null)).toBe('Invalid username or password.');
    expect(failureMessage(429, '900')).toBe('Too many sign-in attempts. Try again in 15 minutes.');
    expect(failureMessage(403, null)).toBe(
      'The security check did not pass. Wait for it to finish, then sign in again.',
    );
    expect(failureMessage(503, null)).toBe('Sign-in is temporarily unavailable. Try again later.');
  });

  it('treats an unknown status like a credential failure rather than leaking detail', () => {
    expect(failureMessage(400, null)).toBe('Invalid username or password.');
    expect(failureMessage(500, null)).toBe('Invalid username or password.');
  });

  it('has a separate prompt for submitting before the check has finished', () => {
    expect(CHALLENGE_PENDING_MESSAGE).toBe('Wait for the security check to finish, then sign in.');
  });
});
