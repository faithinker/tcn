const DAY_MS = 24 * 60 * 60 * 1_000;

export function adminDraftKey(questionId: string): string {
  return `tcn:qna:answer-draft:${questionId}`;
}

export function validateAnswerDraft(value: string): string | null {
  if (value.trim().length === 0) return 'Enter an official answer.';
  if (value.length > 10_000) {
    return 'Keep the official answer to 10,000 characters or fewer.';
  }
  return null;
}

export function formatWaitingAge(createdAt: string, now = new Date()): string {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) return 'Awaiting answer';

  const createdDay = Date.UTC(
    created.getUTCFullYear(),
    created.getUTCMonth(),
    created.getUTCDate(),
  );
  const currentDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.max(0, Math.floor((currentDay - createdDay) / DAY_MS));

  if (days === 0) return 'Today';
  if (days === 1) return '1 day waiting';
  return `${days} days waiting`;
}
