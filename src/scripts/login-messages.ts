// 로그인 화면 문구. 서버가 `retry-after` 로 남은 잠금 시간을 알려 주므로(잠금은 반복될수록 길어진다)
// 고정 문구 대신 그 값을 사람이 읽는 시간으로 바꾼다.

export function waitDescription(retryAfter: string | null): string {
  const seconds = Number(retryAfter);
  if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) return 'a while';

  if (seconds >= 3600) {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function lockedMessage(retryAfter: string | null): string {
  return `Too many sign-in attempts. Try again in ${waitDescription(retryAfter)}.`;
}
