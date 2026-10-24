import { accountRequest, endAccountSession } from './account-client';
import { CHALLENGE_FAILED_MESSAGE, createChallengeGate, setCheckingLabel } from './challenge-gate';
import { buildRecoveryRequestBody } from './recovery-body';
const form = document.getElementById('recovery-form') as HTMLFormElement;
const mode = form.dataset.mode;
const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
const error = form.querySelector<HTMLElement>('[data-form-error]')!;
let busy = false;
let failureShown = false;
// 위젯 토큰은 1회용이다. 보내려는 시도마다 게이트를 되돌려 새 토큰을 받는다. 재설정 완료 화면에는 위젯이 없다.
const gate = createChallengeGate({
  enabled: mode === 'request' && form.dataset.challenge === 'on',
  widgetRoot: form,
  onChange: syncChallenge,
});
function syncChallenge() {
  const pending = gate.pending();
  button.disabled = busy || button.dataset.locked === 'true' || pending;
  setCheckingLabel(button, pending);
  if (!gate.failed()) {
    failureShown = false;
    if (error.textContent === CHALLENGE_FAILED_MESSAGE) error.hidden = true;
  } else if (!failureShown) {
    // 입력 중인 칸의 포커스를 빼앗지 않도록 안내만 띄운다.
    failureShown = true;
    error.textContent = CHALLENGE_FAILED_MESSAGE;
    error.hidden = false;
  }
}
const url = new URL(window.location.href);
let resetToken = url.searchParams.get('token');
if (resetToken) {
  url.searchParams.delete('token');
  history.replaceState(null, '', url.pathname + url.search);
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  if (gate.pending()) return;
  if (gate.failed() && !gate.token()) {
    gate.reset();
    error.hidden = false;
    error.textContent = CHALLENGE_FAILED_MESSAGE;
    error.focus();
    return;
  }
  busy = true;
  syncChallenge();
  form.setAttribute('aria-busy', 'true');
  try {
    const body = buildRecoveryRequestBody(
      Object.fromEntries(new FormData(form)),
      gate.token() || null,
    );
    const response = await accountRequest(
      mode === 'request' ? '/api/auth/forgot-password' : '/api/auth/reset-password',
      mode === 'request' ? body : { ...body, token: resetToken },
    );
    form.reset();
    if (mode === 'request') {
      form.hidden = true;
      document.getElementById('recovery-success')!.hidden = false;
    } else {
      resetToken = null;
      endAccountSession();
      window.location.assign(response.redirectTo);
    }
  } catch (failure) {
    error.hidden = false;
    error.textContent =
      failure instanceof Error ? failure.message : 'Unable to complete this request.';
    error.focus();
  } finally {
    busy = false;
    gate.reset();
    syncChallenge();
    form.removeAttribute('aria-busy');
  }
});
syncChallenge();
form.dataset.ready = 'true';
