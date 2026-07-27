import { ApiRequestError } from '../../lib/admin-api';
import { POST_LIMITS } from '../../lib/posts';

export const saveErrors: Record<string, string> = {
  event_date_required: 'Please select the seminar date.',
  event_date_invalid: 'Please select a valid calendar date.',
  event_date_conflict: 'Another seminar already uses this date.',
  event_date_must_follow_latest: 'A new seminar date must be later than the latest seminar.',
  event_date_immutable:
    'The event date is locked because it determines the public URL and seminar sequence.',
  hero_media_invalid: 'The cover image is no longer available. Choose another image and try again.',
  title_too_long: `The title must be ${POST_LIMITS.title} characters or fewer.`,
  summary_too_long: `The summary must be ${POST_LIMITS.summary} characters or fewer.`,
  address_too_long: `The location must be ${POST_LIMITS.address} characters or fewer.`,
  body_too_long: 'The body is too long to save.',
  revision_conflict: 'Another editor saved changes first. Reload this page before editing again.',
};

export function requestErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) return fallback;
  if (error.code === 'network_error')
    return 'Network unavailable. Check your connection and try again.';
  if (error.code === 'invalid_response')
    return `The server returned an unreadable response (${error.status}). Try again.`;
  if (error.code === 'unauthorized')
    return 'Your session has expired. Sign in again before retrying.';
  return saveErrors[error.code] ?? `${fallback} (${error.code})`;
}
