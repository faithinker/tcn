import { accountMessages } from '../i18n/account';
export class AccountRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
  ) {
    super(accountMessages[code] ?? accountMessages.request_failed);
  }
}
export async function accountRequest<T = { redirectTo: string }>(
  path: string,
  body: Record<string, unknown>,
  options: { method?: string; csrf?: string } = {},
) {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        ...(options.csrf ? { 'x-csrf-token': options.csrf } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AccountRequestError('network_error');
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new AccountRequestError(data.error ?? 'request_failed', response.status);
  return data as T;
}
export async function logoutAccount() {
  const me = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
  if (!me.ok) throw new AccountRequestError('request_failed', me.status);
  const session = (await me.json()) as { csrfToken?: string };
  await accountRequest('/api/auth/logout', {}, { csrf: session.csrfToken });
  endAccountSession();
}
export function endAccountSession() {
  window.dispatchEvent(new Event('tcn-session-ended'));
  for (const store of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[store];
      for (const key of Object.keys(storage))
        if (/^(tcn[._-](auth|account|user|session)|tcn_signup)/.test(key)) storage.removeItem(key);
    } catch {
      /* Storage is optional. */
    }
  }
  try {
    const c = new BroadcastChannel('tcn-auth');
    c.postMessage({ type: 'session-ended' });
    c.close();
  } catch {
    /* storage event fallback below */
  }
  try {
    localStorage.setItem('tcn-session-ended', crypto.randomUUID());
  } catch {
    /* Server still revokes the session. */
  }
}
export function watchAccountSession() {
  function ended() {
    document.querySelectorAll<HTMLInputElement>('input[type=password]').forEach((input) => {
      input.value = '';
    });
    document
      .querySelectorAll<HTMLElement>('[data-header-profile],[data-header-logout]')
      .forEach((el) => {
        el.hidden = true;
      });
    document.querySelectorAll<HTMLElement>('[data-header-sign-in]').forEach((el) => {
      el.hidden = false;
    });
    if (document.querySelector('[data-session-ended]')) return;
    const banner = document.createElement('p');
    banner.dataset.sessionEnded = 'true';
    banner.setAttribute('role', 'alert');
    banner.className =
      'mx-auto max-w-3xl border border-hairline bg-canvas-soft p-5 text-body-sans text-ink';
    banner.textContent = 'Your session has ended. Copy any unsaved text before signing in again. ';
    const link = document.createElement('a');
    link.href = '/login';
    link.textContent = 'Sign in';
    link.className = 'text-link underline';
    banner.appendChild(link);
    const main = document.querySelector('main');
    if (main) main.insertBefore(banner, main.firstChild);
    document
      .querySelectorAll<HTMLButtonElement>(
        '[data-forum-form] button[type=submit],[data-profile-form] button[type=submit],[data-account-password] button[type=submit]',
      )
      .forEach((button) => {
        button.disabled = true;
      });
  }
  window.addEventListener('tcn-session-ended', ended);
  window.addEventListener('storage', (event) => {
    if (event.key === 'tcn-session-ended') ended();
  });
  try {
    const channel = new BroadcastChannel('tcn-auth');
    channel.onmessage = (event) => {
      if (event.data?.type === 'session-ended') ended();
    };
    window.addEventListener('pagehide', () => channel.close(), { once: true });
  } catch {
    /* Storage events remain available. */
  }
}
