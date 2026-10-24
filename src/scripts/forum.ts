import { ApiRequestError } from '../lib/admin-api';
import { ForumInputError, parseBoard } from '../lib/forum/payload';
import { forumCopy as copy } from '../lib/forum/copy';
import { forumErrorMessage, mutateForumPost } from './forum-actions';

function showError(root: HTMLElement, error: unknown) {
  const notice = root.querySelector<HTMLElement>('[data-forum-notice]');
  const code =
    error instanceof ApiRequestError
      ? error.code
      : error instanceof ForumInputError
        ? 'invalid_input'
        : 'request_failed';
  if (notice) {
    notice.textContent = forumErrorMessage(code);
    notice.classList.remove('hidden');
    notice.focus();
  }
  const latest = root.querySelector<HTMLElement>('[data-forum-latest]');
  if (latest && code === 'revision_conflict') {
    latest.classList.remove('hidden');
    latest.classList.add('inline-flex');
  }
}

document.querySelectorAll<HTMLFormElement>('[data-forum-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button[type=submit]');
    if (!button || button.disabled) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = copy.saving;
    form.setAttribute('aria-busy', 'true');
    try {
      const data = new FormData(form);
      const location = await mutateForumPost({
        action: form.dataset.postId ? 'edit' : 'create',
        board: parseBoard(form.dataset.board),
        id: form.dataset.postId,
        expectedRevision: Number(form.dataset.revision),
        title: String(data.get('title') ?? ''),
        body: String(data.get('body') ?? ''),
        csrf: form.dataset.csrf ?? '',
      });
      window.location.assign(location);
    } catch (error) {
      showError(form, error);
      button.disabled = false;
      button.textContent = original;
      form.removeAttribute('aria-busy');
    }
  });
});

document.querySelectorAll<HTMLElement>('[data-forum-hide]').forEach((root) => {
  const button = root.querySelector<HTMLButtonElement>('button');
  button?.addEventListener('click', async () => {
    if (button.disabled || !window.confirm(copy.hideConfirm)) return;
    button.disabled = true;
    button.textContent = copy.hiding;
    root.setAttribute('aria-busy', 'true');
    try {
      const location = await mutateForumPost({
        action: 'hide',
        board: parseBoard(root.dataset.board),
        id: root.dataset.postId,
        expectedRevision: Number(root.dataset.revision),
        csrf: root.dataset.csrf ?? '',
      });
      window.location.assign(location);
    } catch (error) {
      showError(root, error);
      button.disabled = false;
      button.textContent = copy.hide;
      root.removeAttribute('aria-busy');
    }
  });
});
