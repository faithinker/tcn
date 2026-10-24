import { describe, expect, it } from 'vitest';
import { buildRecoveryRequestBody } from './recovery-body';

describe('buildRecoveryRequestBody', () => {
  it('sends the Turnstile token as turnstileToken and drops the hidden input the widget injects', () => {
    expect(
      buildRecoveryRequestBody(
        { email: 'member@example.org', 'cf-turnstile-response': 'widget-token' },
        'widget-token',
      ),
    ).toEqual({ email: 'member@example.org', turnstileToken: 'widget-token' });
  });

  it('keeps the form fields untouched and adds no token when the challenge is off', () => {
    expect(buildRecoveryRequestBody({ email: 'member@example.org' }, null)).toEqual({
      email: 'member@example.org',
    });
  });

  it('never lets a form field overwrite the token', () => {
    expect(
      buildRecoveryRequestBody({ email: 'a@b.co', turnstileToken: 'forged' }, 'real-token'),
    ).toEqual({ email: 'a@b.co', turnstileToken: 'real-token' });
  });

  it('does not mutate the fields it was given', () => {
    const fields = { email: 'a@b.co', 'cf-turnstile-response': 'x' };
    buildRecoveryRequestBody(fields, 'x');
    expect(fields).toEqual({ email: 'a@b.co', 'cf-turnstile-response': 'x' });
  });
});
