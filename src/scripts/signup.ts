import { accountRequest, AccountRequestError } from './account-client';
import {
  CHALLENGE_FAILED_MESSAGE,
  CHECKING_LABEL,
  createChallengeGate,
  setCheckingLabel,
} from './challenge-gate';
const root = document.getElementById('signup-root')!;
const emailForm = document.getElementById('signup-email-form') as HTMLFormElement;
const codeForm = document.getElementById('signup-code-form') as HTMLFormElement;
const detailForm = document.getElementById('signup-form') as HTMLFormElement;
const emailInput = document.getElementById('signup-email') as HTMLInputElement;
const resend = document.getElementById('resend-signup-code') as HTMLButtonElement;
const sendButton = document.getElementById('send-signup-code') as HTMLButtonElement;
let retryAt = 0,
  expiresAt = Number(root.dataset.expiresAt ?? 0) * 1000;
let inFlight = false;
let failureShown = false;
// 위젯 토큰은 1회용이다. 코드를 보내려는 시도마다 게이트를 되돌려 새 토큰을 받는다.
const gate = createChallengeGate({
  enabled: root.dataset.challenge === 'on',
  widgetRoot: root,
  onChange: syncChallenge,
});
function formError(form: HTMLFormElement, error: unknown) {
  const el = form.querySelector<HTMLElement>('[data-form-error]')!;
  el.textContent = error instanceof Error ? error.message : 'Unable to continue. Please try again.';
  el.hidden = false;
  el.focus();
}
function clearErrors() {
  document.querySelectorAll<HTMLElement>('[data-form-error]').forEach((el) => {
    el.hidden = true;
  });
}
function syncChallenge() {
  const pending = gate.pending();
  sendButton.disabled = inFlight || sendButton.dataset.locked === 'true' || pending;
  setCheckingLabel(sendButton, pending);
  if (!gate.failed()) {
    failureShown = false;
    document.querySelectorAll<HTMLElement>('[data-form-error]').forEach((el) => {
      if (el.textContent === CHALLENGE_FAILED_MESSAGE) el.hidden = true;
    });
  } else if (!failureShown) {
    // 입력 중인 칸의 포커스를 빼앗지 않도록 안내만 띄운다.
    failureShown = true;
    const el = (codeForm.hidden ? emailForm : codeForm).querySelector<HTMLElement>(
      '[data-form-error]',
    )!;
    el.textContent = CHALLENGE_FAILED_MESSAGE;
    el.hidden = false;
  }
  tick();
}
function state(verified: boolean, sent: boolean) {
  root.dataset.verified = String(verified);
  root.dataset.codeSent = String(sent);
  document.getElementById('signup-email-section')!.hidden = verified;
  document.getElementById('signup-details-section')!.hidden = !verified;
  codeForm.hidden = !sent;
  emailInput.disabled = sent;
  document.getElementById('send-signup-code')!.hidden = sent;
  (document.getElementById('verified-signup-email') as HTMLInputElement).value =
    root.dataset.email ?? '';
  document.getElementById('signup-step-email')!.toggleAttribute('aria-current', !verified);
  document.getElementById('signup-step-details')!.toggleAttribute('aria-current', verified);
  document
    .getElementById(verified ? 'signup-step-details' : 'signup-step-email')!
    .setAttribute('aria-current', 'step');
}
function busy(value: boolean) {
  inFlight = value;
  for (const form of [emailForm, codeForm, detailForm])
    form.setAttribute('aria-busy', String(value));
  root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = value || button.dataset.locked === 'true';
  });
  syncChallenge();
}
function tick() {
  const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  const checking = gate.pending() && remaining === 0;
  resend.disabled = inFlight || remaining > 0 || gate.pending();
  resend.textContent = remaining
    ? `Resend in ${remaining}s`
    : checking
      ? CHECKING_LABEL
      : 'Resend code';
  const expiry = document.getElementById('signup-code-expiry')!;
  if (expiresAt && root.dataset.verified !== 'true')
    expiry.textContent =
      expiresAt > Date.now()
        ? `Expires in ${Math.ceil((expiresAt - Date.now()) / 60000)} min.`
        : 'Code expired. Request a new code.';
}
async function sendCode(form: HTMLFormElement) {
  if (inFlight) return;
  clearErrors();
  if (gate.pending() || (gate.failed() && !gate.token())) {
    if (gate.failed()) {
      gate.reset();
      formError(form, new Error(CHALLENGE_FAILED_MESSAGE));
    }
    return;
  }
  busy(true);
  try {
    const email = emailInput.value.trim();
    await accountRequest('/api/auth/signup/start', {
      email,
      ...(gate.token() ? { turnstileToken: gate.token() } : {}),
    });
    root.dataset.email = email.toLowerCase();
    retryAt = Date.now() + 60000;
    expiresAt = Date.now() + 600000;
    state(false, true);
    codeForm.reset();
    document.getElementById('signup-code')?.focus();
  } catch (error) {
    formError(form, error);
    if (error instanceof AccountRequestError && error.status === 429) retryAt = Date.now() + 60000;
  } finally {
    gate.reset();
    busy(false);
  }
}
emailForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void sendCode(emailForm);
});
resend.addEventListener('click', () => void sendCode(codeForm));
codeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (inFlight) return;
  clearErrors();
  busy(true);
  try {
    const response = await accountRequest<{ email: string; expiresAt: number }>(
      '/api/auth/signup/verify',
      { code: new FormData(codeForm).get('code') },
    );
    root.dataset.email = response.email;
    expiresAt = response.expiresAt * 1000;
    state(true, true);
    detailForm.querySelector<HTMLInputElement>('input')?.focus();
  } catch (error) {
    formError(codeForm, error);
  } finally {
    busy(false);
  }
});
root.querySelectorAll('[data-change-signup-email]').forEach((button) =>
  button.addEventListener('click', async () => {
    if (inFlight) return;
    busy(true);
    try {
      await accountRequest('/api/auth/signup/cancel', {});
      root.dataset.email = '';
      root.dataset.expiresAt = '';
      expiresAt = 0;
      state(false, false);
      clearErrors();
      detailForm.reset();
      emailInput.focus();
    } catch (error) {
      formError(root.dataset.verified === 'true' ? detailForm : codeForm, error);
    } finally {
      busy(false);
    }
  }),
);
detailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (inFlight) return;
  clearErrors();
  busy(true);
  try {
    const response = await accountRequest('/api/auth/signup', {
      ...Object.fromEntries(new FormData(detailForm)),
      email: root.dataset.email,
    });
    detailForm.reset();
    window.location.assign(response.redirectTo);
  } catch (error) {
    formError(detailForm, error);
  } finally {
    busy(false);
  }
});
if (root.dataset.codeSent === 'true' && root.dataset.verified !== 'true')
  retryAt = Math.max(0, expiresAt - 600000 + 60000);
syncChallenge();
const timer = window.setInterval(tick, 1000);
window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
root.dataset.ready = 'true';
