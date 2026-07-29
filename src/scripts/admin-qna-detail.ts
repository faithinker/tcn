import { adjustWaitingCount, adminDraftKey, validateAnswerDraft } from './admin-qna-utils';

interface AnswerResponse {
  answer?: { body?: unknown; revision?: unknown };
}

interface VisibilityResponse {
  question?: { revision?: unknown; visibility?: unknown; answer?: unknown };
}

const root = document.querySelector<HTMLElement>('[data-admin-qna-detail]');
const form = document.querySelector<HTMLFormElement>('#official-answer-form');
const textarea = document.querySelector<HTMLTextAreaElement>('#official-answer');
const saveButton = document.querySelector<HTMLButtonElement>('#save-answer');
const visibilityButton = document.querySelector<HTMLButtonElement>('#change-visibility');
const notice = document.querySelector<HTMLElement>('#admin-qna-detail-notice');
const summary = document.querySelector<HTMLElement>('#answer-error-summary');
const fieldError = document.querySelector<HTMLElement>('#answer-field-error');
const counter = document.querySelector<HTMLElement>('#answer-count');
const answerRevision = document.querySelector<HTMLElement>('#answer-revision');
const statusBadge = document.querySelector<HTMLElement>('#question-status');
const waitingCount = document.querySelector<HTMLElement>('#admin-waiting-count');

const questionId = root?.dataset.questionId ?? '';
const storageKey = adminDraftKey(questionId);

function saveDraft(): void {
  if (!textarea) return;
  try {
    sessionStorage.setItem(storageKey, textarea.value);
  } catch {
    // A blocked storage API must not prevent editing or submitting.
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // Storage can be unavailable in locked-down browsers.
  }
}

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

function showAnswerError(message: string): void {
  if (summary) {
    summary.textContent = message;
    summary.classList.remove('hidden');
    summary.focus();
  }
  if (fieldError) {
    fieldError.textContent = message;
    fieldError.classList.remove('hidden');
  }
  textarea?.setAttribute('aria-invalid', 'true');
}

function clearAnswerError(): void {
  summary?.classList.add('hidden');
  fieldError?.classList.add('hidden');
  textarea?.removeAttribute('aria-invalid');
}

function updateCount(): void {
  if (counter && textarea) counter.textContent = textarea.value.length.toLocaleString('en-US');
}

function updateWaitingCount(delta: number): void {
  if (!waitingCount) return;
  const current = Number(waitingCount.textContent);
  if (!Number.isSafeInteger(current)) return;
  waitingCount.textContent = String(adjustWaitingCount(current, delta));
}

function restoreDraft(): void {
  if (!textarea) return;
  try {
    const draft = sessionStorage.getItem(storageKey);
    if (draft !== null) textarea.value = draft;
  } catch {
    // Keep the server-rendered current answer.
  }
  updateCount();
}

function sessionRecovery(message: string): void {
  saveDraft();
  showNotice(message, 'Sign in', () => {
    window.location.assign(root?.dataset.loginUrl ?? '/admin/login');
  });
}

restoreDraft();
textarea?.addEventListener('input', () => {
  saveDraft();
  updateCount();
  clearAnswerError();
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!root || !textarea || !saveButton) return;

  clearAnswerError();
  const validationError = validateAnswerDraft(textarea.value);
  if (validationError) {
    showAnswerError(validationError);
    return;
  }

  saveDraft();
  saveButton.disabled = true;
  saveButton.textContent = 'Saving…';
  const wasWaiting =
    root.dataset.questionVisibility !== 'hidden' && Number(root.dataset.answerRevision ?? 0) === 0;
  try {
    const response = await fetch(`/api/questions/${encodeURIComponent(questionId)}/answer`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': root.dataset.csrfToken ?? '',
      },
      body: JSON.stringify({
        body: textarea.value,
        expectedRevision: Number(root.dataset.answerRevision ?? 0),
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as AnswerResponse;
      const revision = payload.answer?.revision;
      if (typeof revision === 'number' && Number.isSafeInteger(revision)) {
        root.dataset.answerRevision = String(revision);
        if (answerRevision) answerRevision.textContent = String(revision);
      }
      if (typeof payload.answer?.body === 'string') textarea.value = payload.answer.body;
      clearDraft();
      updateCount();
      saveButton.textContent = 'Update official answer';
      if (statusBadge && root.dataset.questionVisibility !== 'hidden') {
        statusBadge.textContent = 'Answered';
      }
      if (wasWaiting) updateWaitingCount(-1);
      showNotice('Official answer saved and published.');
      return;
    }
    if (response.status === 401) {
      sessionRecovery('Your session expired. Your draft is saved in this browser.');
    } else if (response.status === 409) {
      saveDraft();
      showNotice(
        'Another administrator changed this answer. Your draft is saved. Reload the latest revision before saving again.',
        'Reload latest',
        () => window.location.reload(),
      );
    } else if (response.status === 404) {
      showNotice('This question is no longer available.', 'Questions queue', () =>
        window.location.assign('/admin/questions'),
      );
    } else if (response.status === 403) {
      showNotice(
        'This request could not be verified. Reload the page and try again.',
        'Reload',
        () => window.location.reload(),
      );
    } else {
      showNotice('The answer could not be saved. Your draft is still available; try again.');
    }
  } catch {
    showNotice('Network unavailable. Your draft is still available; try again.');
  } finally {
    saveButton.disabled = false;
    if (saveButton.textContent === 'Saving…') {
      saveButton.textContent =
        Number(root.dataset.answerRevision ?? 0) === 0
          ? 'Publish official answer'
          : 'Update official answer';
    }
  }
});

async function changeVisibility(
  nextVisibility: 'visible' | 'hidden',
  isUndo = false,
): Promise<void> {
  if (!root || !visibilityButton) return;
  visibilityButton.disabled = true;
  visibilityButton.textContent = nextVisibility === 'hidden' ? 'Hiding…' : 'Restoring…';
  try {
    const response = await fetch(`/api/questions/${encodeURIComponent(questionId)}/visibility`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': root.dataset.csrfToken ?? '',
      },
      body: JSON.stringify({
        visibility: nextVisibility,
        expectedRevision: Number(root.dataset.questionRevision ?? 0),
      }),
    });
    if (response.ok) {
      const payload = (await response.json()) as VisibilityResponse;
      const revision = payload.question?.revision;
      if (typeof revision === 'number' && Number.isSafeInteger(revision)) {
        root.dataset.questionRevision = String(revision);
      }
      if (Number(root.dataset.answerRevision ?? 0) === 0) {
        updateWaitingCount(nextVisibility === 'hidden' ? -1 : 1);
      }
      root.dataset.questionVisibility = nextVisibility;
      visibilityButton.textContent =
        nextVisibility === 'hidden' ? 'Restore question' : 'Hide question';
      if (statusBadge) {
        statusBadge.textContent =
          nextVisibility === 'hidden'
            ? 'Hidden'
            : Number(root.dataset.answerRevision ?? 0) > 0
              ? 'Answered'
              : 'Awaiting answer';
      }
      if (nextVisibility === 'hidden') {
        showNotice('Question hidden from the public Q&A.', 'Undo', () => {
          void changeVisibility('visible', true);
        });
      } else {
        showNotice(isUndo ? 'Hide undone. The question is public again.' : 'Question restored.');
      }
      return;
    }
    if (response.status === 401) {
      sessionRecovery('Your session expired. Your answer draft is saved in this browser.');
    } else if (response.status === 409) {
      showNotice(
        'This question changed in another session. Reload the latest version.',
        'Reload',
        () => window.location.reload(),
      );
    } else if (response.status === 404) {
      showNotice('This question is no longer available.', 'Questions queue', () =>
        window.location.assign('/admin/questions'),
      );
    } else {
      showNotice('Visibility could not be changed. Reload and try again.', 'Reload', () =>
        window.location.reload(),
      );
    }
  } catch {
    showNotice('Network unavailable. Visibility was not changed; try again.');
  } finally {
    visibilityButton.disabled = false;
    visibilityButton.textContent =
      root.dataset.questionVisibility === 'hidden' ? 'Restore question' : 'Hide question';
  }
}

visibilityButton?.addEventListener('click', () => {
  const next = root?.dataset.questionVisibility === 'hidden' ? 'visible' : 'hidden';
  void changeVisibility(next);
});
