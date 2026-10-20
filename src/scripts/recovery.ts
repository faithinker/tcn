import { accountRequest, endAccountSession } from './account-client';
const form = document.getElementById('recovery-form') as HTMLFormElement;
const mode = form.dataset.mode;
const url = new URL(window.location.href);
let resetToken = url.searchParams.get('token');
if (resetToken) {
  url.searchParams.delete('token');
  history.replaceState(null, '', url.pathname + url.search);
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const error = form.querySelector<HTMLElement>('[data-form-error]')!;
  error.hidden = true;
  button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    const body = Object.fromEntries(new FormData(form));
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
    button.disabled = false;
    form.removeAttribute('aria-busy');
  }
});
form.dataset.ready = 'true';
