import { adjustWaitingCount } from './admin-qna-utils';

const root = document.querySelector<HTMLElement>('[data-admin-qna-list]');
const notice = document.querySelector<HTMLElement>('#admin-qna-notice');

function showNotice(message: string, actionLabel?: string, action?: () => void): void {
  if (!notice) return;
  const text = document.createElement('span');
  text.textContent = message;
  notice.replaceChildren(text);
  if (actionLabel && action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'min-h-12 shrink-0 border border-hairline-strong px-4 font-sans text-caption font-bold';
    button.textContent = actionLabel;
    button.addEventListener('click', action);
    notice.appendChild(button);
  }
  notice.classList.remove('hidden');
  notice.classList.add('flex');
  notice.focus();
}

function updateQueueCount(status: 'waiting' | 'answered' | 'hidden', delta: number): void {
  const count = document.querySelector<HTMLElement>(`#admin-count-${status}`);
  if (!count) return;
  const next = adjustWaitingCount(Number(count.dataset.count ?? count.textContent ?? 0), delta);
  count.dataset.count = String(next);
  count.textContent = String(next);
}

function updateHeaderWaitingCount(delta: number): void {
  const count = document.querySelector<HTMLElement>('#admin-waiting-count');
  if (!count) return;
  const current = Number(count.textContent);
  if (!Number.isSafeInteger(current)) return;
  count.textContent = String(adjustWaitingCount(current, delta));
}

function showEmptyStateIfNeeded(): void {
  const list = document.querySelector<HTMLOListElement>('#admin-question-list');
  if (!list || list.querySelector('[data-question-row]')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'py-12 text-center';
  const message = document.createElement('p');
  message.className = 'font-sans text-body-sm text-body-muted';
  message.textContent = 'There are no hidden questions.';
  wrapper.appendChild(message);
  list.replaceWith(wrapper);
}

root?.querySelectorAll<HTMLButtonElement>('[data-restore-question]').forEach((button) => {
  button.addEventListener('click', async () => {
    const questionId = button.dataset.questionId;
    const expectedRevision = Number(button.dataset.questionRevision);
    const restoreStatus = button.dataset.restoreStatus;
    const csrfToken = root.dataset.csrfToken;
    if (
      !questionId ||
      !Number.isSafeInteger(expectedRevision) ||
      (restoreStatus !== 'waiting' && restoreStatus !== 'answered') ||
      !csrfToken
    )
      return;

    button.disabled = true;
    button.textContent = 'Restoring…';
    try {
      const response = await fetch(`/api/questions/${encodeURIComponent(questionId)}/visibility`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ visibility: 'visible', expectedRevision }),
      });
      if (response.ok) {
        button.closest('[data-question-row]')?.remove();
        updateQueueCount('hidden', -1);
        updateQueueCount(restoreStatus, 1);
        if (restoreStatus === 'waiting') updateHeaderWaitingCount(1);
        showEmptyStateIfNeeded();
        showNotice('Question restored to the public Q&A.');
        return;
      }
      if (response.status === 401) {
        showNotice(
          'Your session expired. Sign in again to restore this question.',
          'Sign in',
          () => {
            window.location.assign(root.dataset.loginUrl ?? '/admin/login');
          },
        );
      } else if (response.status === 409) {
        showNotice(
          'This question changed in another session. Reload the latest version.',
          'Reload',
          () => window.location.reload(),
        );
      } else if (response.status === 404) {
        button.closest('[data-question-row]')?.remove();
        showEmptyStateIfNeeded();
        showNotice('This question is no longer available.');
        return;
      } else {
        showNotice('The question could not be restored. Reload and try again.', 'Reload', () =>
          window.location.reload(),
        );
      }
    } catch {
      showNotice('Network unavailable. The question is still hidden; try again.');
    }
    button.disabled = false;
    button.textContent = 'Restore';
  });
});
