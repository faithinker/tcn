import {
  accountRequest,
  AccountRequestError,
  endAccountSession,
  logoutAccount,
} from './account-client';
const root = document.getElementById('account-root');
const csrf = root?.dataset.csrf ?? '';
const profile = document.getElementById('profile-form') as HTMLFormElement;
const edit = document.getElementById('profile-edit') as HTMLButtonElement;
function errorIn(form: HTMLElement, error: unknown) {
  const el = form.querySelector<HTMLElement>('[data-form-error]');
  if (el) {
    el.hidden = false;
    el.textContent = error instanceof Error ? error.message : 'Unable to complete this request.';
    el.focus();
  }
  if (error instanceof AccountRequestError && error.status === 401) {
    endAccountSession();
    form.querySelectorAll<HTMLInputElement>('input[type=password]').forEach((input) => {
      input.value = '';
    });
  }
}
function busy(form: HTMLFormElement, value: boolean) {
  form.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = value;
  });
  form.setAttribute('aria-busy', String(value));
}
function clearError(form: HTMLElement) {
  const el = form.querySelector<HTMLElement>('[data-form-error]');
  if (el) el.hidden = true;
}
function showEditor(open: boolean) {
  profile.hidden = !open;
  edit.setAttribute('aria-expanded', String(open));
  edit.hidden = open;
  document.getElementById('profile-summary')!.hidden = open;
  if (open) {
    document.getElementById('profile-saved')!.hidden = true;
    profile.querySelector<HTMLInputElement>('input')?.focus();
  } else edit.focus();
}
edit?.addEventListener('click', () => showEditor(true));
document.getElementById('profile-cancel')?.addEventListener('click', () => {
  profile.reset();
  dirty = false;
  clearError(profile);
  showEditor(false);
});
let dirty = false;
profile?.addEventListener('input', () => {
  dirty = true;
});
window.addEventListener('beforeunload', (event) => {
  if (dirty && !profile.hidden) {
    event.preventDefault();
  }
});
profile?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError(profile);
  busy(profile, true);
  try {
    const values = new FormData(profile);
    const response = await accountRequest<{
      profile: { displayName: string; affiliation: string | null };
    }>(
      '/api/account/profile',
      { displayName: values.get('displayName'), affiliation: values.get('affiliation') },
      { method: 'PATCH', csrf },
    );
    const result = response.profile as { displayName: string; affiliation: string | null };
    root!.querySelector('[data-profile-name]')!.textContent = result.displayName;
    root!.querySelector('[data-profile-affiliation]')!.textContent =
      result.affiliation ?? 'Not provided';
    for (const [key, value] of Object.entries(result)) {
      const input = profile.elements.namedItem(key) as HTMLInputElement;
      input.value = value ?? '';
      input.defaultValue = value ?? '';
    }
    dirty = false;
    showEditor(false);
    document.getElementById('profile-saved')!.hidden = false;
  } catch (error) {
    errorIn(profile, error);
  } finally {
    busy(profile, false);
  }
});
const passwordForm = document.querySelector<HTMLFormElement>('[data-account-password]');
document.querySelector('[data-cancel-password]')?.addEventListener('click', () => {
  passwordForm?.reset();
  if (passwordForm) clearError(passwordForm);
  (document.getElementById('password-details') as HTMLDetailsElement).open = false;
});
passwordForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError(passwordForm);
  busy(passwordForm, true);
  try {
    const data = await accountRequest(
      '/api/account/password',
      Object.fromEntries(new FormData(passwordForm)),
      { csrf },
    );
    dirty = false;
    passwordForm.reset();
    endAccountSession();
    window.location.assign(data.redirectTo);
  } catch (error) {
    errorIn(passwordForm, error);
  } finally {
    busy(passwordForm, false);
  }
});
const dialog = document.getElementById('withdrawal-dialog') as HTMLDialogElement;
const withdrawal = document.getElementById('withdrawal-form') as HTMLFormElement;
const trigger = document.getElementById('open-withdrawal');
let withdrawing = false;
let requestId = crypto.randomUUID();
trigger?.addEventListener('click', () => {
  withdrawal.reset();
  clearError(withdrawal);
  requestId = crypto.randomUUID();
  dialog.showModal();
  document.getElementById('cancel-withdrawal')?.focus();
});
document.getElementById('cancel-withdrawal')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('cancel', (event) => {
  if (withdrawing) event.preventDefault();
});
dialog?.addEventListener('close', () => {
  withdrawal.reset();
  trigger?.focus();
});
withdrawal?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (withdrawing) return;
  clearError(withdrawal);
  withdrawing = true;
  busy(withdrawal, true);
  try {
    const data = await accountRequest(
      '/api/account/withdraw',
      {
        currentPassword: new FormData(withdrawal).get('currentPassword'),
        confirmation: true,
        requestId,
      },
      { csrf },
    );
    dirty = false;
    withdrawal.reset();
    endAccountSession();
    window.location.assign(data.redirectTo);
  } catch (error) {
    if (
      error instanceof AccountRequestError &&
      (error.code === 'network_error' || error.status === 401)
    ) {
      errorIn(
        withdrawal,
        new Error(
          'Your account closure could not be confirmed. If your session has ended, sign in to check your account or contact the Secretariat.',
        ),
      );
      if (error.status === 401) {
        withdrawal.reset();
        endAccountSession();
      }
    } else errorIn(withdrawal, error);
  } finally {
    withdrawing = false;
    busy(withdrawal, false);
  }
});
document.getElementById('account-logout')?.addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  try {
    await logoutAccount();
    dirty = false;
    window.location.assign('/login');
  } catch {
    const el = document.getElementById('account-error')!;
    el.textContent = 'Unable to log out. Please try again.';
    el.hidden = false;
    el.focus();
    button.disabled = false;
  }
});
if (root) root.dataset.ready = 'true';
