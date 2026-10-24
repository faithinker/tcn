import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../../lib/admin-api';
import { POST_LIMITS } from '../../lib/posts/payload';
import { requestErrorMessage, saveErrors } from './editor-messages';

const FALLBACK = 'Save failed. Try again.';

describe('requestErrorMessage', () => {
  it('returns the fallback for non-API errors', () => {
    expect(requestErrorMessage(new Error('boom'), FALLBACK)).toBe(FALLBACK);
    expect(requestErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(requestErrorMessage('string error', FALLBACK)).toBe(FALLBACK);
  });

  it('maps transport-level codes to actionable guidance', () => {
    expect(requestErrorMessage(new ApiRequestError('network_error', 0), FALLBACK)).toMatch(
      /Network unavailable/,
    );
    expect(requestErrorMessage(new ApiRequestError('invalid_response', 502), FALLBACK)).toContain(
      '(502)',
    );
    expect(requestErrorMessage(new ApiRequestError('unauthorized', 401), FALLBACK)).toMatch(
      /Sign in again/,
    );
    expect(requestErrorMessage(new ApiRequestError('invalid_csrf', 403), FALLBACK)).toMatch(
      /Reload this page/,
    );
  });

  it('keeps the API error code visible for unmapped codes', () => {
    expect(requestErrorMessage(new ApiRequestError('mystery_code', 400), FALLBACK)).toBe(
      `${FALLBACK} (mystery_code)`,
    );
  });

  it('states the configured limits in length error copy', () => {
    expect(saveErrors.title_too_long).toContain(String(POST_LIMITS.title));
    expect(saveErrors.summary_too_long).toContain(String(POST_LIMITS.summary));
    expect(saveErrors.address_too_long).toContain(String(POST_LIMITS.address));
  });
});
