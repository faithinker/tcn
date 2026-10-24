import { permissionState, userMutationMessage } from './users-utils';
const root = document.querySelector<HTMLElement>('[data-users-admin]');
if (root) {
  const notice = root.querySelector<HTMLElement>('[data-users-notice]')!;
  const attempts = new Map<string, { fingerprint: string; requestId: string }>();
  const busy = new Set<HTMLElement>();
  function show(message: string, reload = false) {
    notice.replaceChildren(document.createTextNode(message + ' '));
    if (reload) {
      const link = document.createElement('a');
      link.href = location.href;
      link.textContent = 'Reload latest state';
      link.className = 'underline font-bold';
      notice.appendChild(link);
    }
    notice.hidden = false;
    notice.focus();
  }
  async function mutate(
    row: HTMLElement,
    kind: 'status' | 'permissions',
    value: Record<string, unknown>,
  ) {
    if (busy.has(row)) return;
    const description =
      kind === 'status'
        ? `Set this account to ${value.status}?`
        : value.isExecutive
          ? 'Grant executive authority? This account will become protected and cannot be changed here again.'
          : 'Save these permissions?';
    if (!window.confirm(description)) return;
    const payload = { ...value, expectedRevision: Number(row.dataset.revision) };
    const key = `${row.dataset.userId}:${kind}`;
    const fingerprint = JSON.stringify(payload);
    const attempt = attempts.get(key);
    const requestId =
      attempt?.fingerprint === fingerprint ? attempt.requestId : crypto.randomUUID();
    attempts.set(key, { fingerprint, requestId });
    busy.add(row);
    row.setAttribute('aria-busy', 'true');
    const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>('button'));
    buttons.forEach((button) => (button.disabled = true));
    try {
      const response = await fetch(
        `/api/users/${encodeURIComponent(row.dataset.userId!)}/${kind}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'x-csrf-token': root!.dataset.csrfToken! },
          body: JSON.stringify({ ...payload, requestId }),
        },
      );
      if (response.status === 401) {
        location.assign(root!.dataset.loginUrl!);
        return;
      }
      if (!response.ok) {
        show(
          userMutationMessage(response.status),
          response.status === 409 || response.status === 403 || response.status === 404,
        );
        return;
      }
      const result = await response.json();
      if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
        show(userMutationMessage(0));
        return;
      }
      location.reload();
    } catch {
      show(userMutationMessage(0));
    } finally {
      busy.delete(row);
      row.removeAttribute('aria-busy');
      buttons.forEach((button) => (button.disabled = false));
    }
  }
  root.querySelectorAll<HTMLButtonElement>('[data-user-status]').forEach((button) =>
    button.addEventListener('click', () => {
      void mutate(button.closest<HTMLElement>('[data-user-row]')!, 'status', {
        status: button.dataset.userStatus,
      });
    }),
  );
  root.querySelectorAll<HTMLFormElement>('[data-user-permissions]').forEach((form) => {
    // Worker HTMLRewriter also declares HTMLSelectElement; use the DOM element's
    // actual properties without merging those unrelated ambient interfaces.
    const role = form.querySelector<HTMLElement & { value: string }>('[name="role"]')!;
    const executive = form.querySelector<HTMLInputElement>('[name="isExecutive"]')!;
    const special = form.querySelector<HTMLInputElement>('[name="canAccessDirectorsForum"]')!;
    role.addEventListener('change', () => {
      executive.disabled = role.value !== 'officer';
      special.disabled = role.value !== 'member';
      if (executive.disabled) executive.checked = false;
      if (special.disabled) special.checked = false;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void mutate(
        form.closest<HTMLElement>('[data-user-row]')!,
        'permissions',
        permissionState(role.value, executive.checked, special.checked),
      );
    });
  });
}
