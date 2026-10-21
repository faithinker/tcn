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

/** 서버 응답 상태를 로그인 화면 문구로 바꾼다. 알 수 없는 상태는 자격 증명 실패와 같게 보인다. */
export function failureMessage(status: number, retryAfter: string | null): string {
  if (status === 429) return lockedMessage(retryAfter);
  if (status === 403) {
    return 'The security check did not pass. Wait for it to finish, then sign in again.';
  }
  if (status === 503) return 'Sign-in is temporarily unavailable. Try again later.';
  return 'Invalid username or password.';
}
