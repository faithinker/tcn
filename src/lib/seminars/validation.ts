import { isSeminarEventDate } from './url';

export type SeminarDateValidationError =
  | 'event_date_required'
  | 'event_date_invalid'
  | 'event_date_conflict'
  | 'event_date_must_follow_latest'
  | 'event_date_immutable';

interface SeminarDateValidationInput {
  eventDate: string | null | undefined;
  existingDates: string[];
  currentEventDate?: string | null;
}

export function validateSeminarDate({
  eventDate,
  existingDates,
  currentEventDate,
}: SeminarDateValidationInput): SeminarDateValidationError | null {
  if (!eventDate) return 'event_date_required';
  if (!isSeminarEventDate(eventDate)) return 'event_date_invalid';
  if (currentEventDate && eventDate !== currentEventDate) return 'event_date_immutable';
  if (eventDate !== currentEventDate && existingDates.includes(eventDate))
    return 'event_date_conflict';
  if (!currentEventDate) {
    const latest = existingDates.toSorted((a, b) => a.localeCompare(b)).at(-1);
    if (latest && eventDate <= latest) return 'event_date_must_follow_latest';
  }
  return null;
}

export function isSeminarDateConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('posts_visible_event_date_unique') ||
    error.message.includes('UNIQUE constraint failed: posts.event_date')
  );
}
