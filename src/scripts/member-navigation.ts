import { memberNavigation, type MemberSession } from '../lib/membership/navigation';
import { t } from '../i18n/ui';

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-header-logout]')) {
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const error = document.querySelector<HTMLElement>('[data-header-auth-error]');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    if (error) error.hidden = true;
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Logout failed');
      window.location.assign('/');
    } catch {
      if (error) {
        error.textContent = t('nav.logoutFailed');
        error.hidden = false;
      }
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  });
}

async function loadMemberNavigation() {
  try {
    const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return;
    const payload: MemberSession = await response.json();
    for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-header-sign-in]')) {
      link.hidden = payload.authenticated === true;
      link.href = payload.memberFeaturesEnabled === false ? '/admin/login' : '/login';
    }
    for (const control of document.querySelectorAll<HTMLElement>(
      '[data-header-profile], [data-header-logout]',
    )) {
      control.hidden = payload.authenticated !== true;
    }
    const links = memberNavigation(payload);
    const allowedLinks = new Set(links.map((link) => link.href));
    for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-board-link]')) {
      link.hidden =
        link.dataset.boardLink !== '/questions' && !allowedLinks.has(link.dataset.boardLink!);
    }
    for (const container of document.querySelectorAll<HTMLElement>('[data-member-navigation]')) {
      const list = document.createElement('ul');
      list.className = 'space-y-1';
      for (const link of links) {
        const item = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.textContent = link.label;
        anchor.className =
          container.dataset.memberNavigation === 'footer'
            ? 'inline-flex min-h-11 items-center text-body-sans text-on-footer/90 underline'
            : 'flex min-h-11 items-center px-3 text-body-sm font-bold text-ink no-underline hover:bg-canvas-soft';
        item.appendChild(anchor);
        list.appendChild(item);
      }
      container.replaceChildren(list);
      container.hidden = links.length === 0;
    }
  } catch {
    // The public navigation remains usable when account status cannot be loaded.
  } finally {
    document.documentElement.dataset.memberNavigationReady = 'true';
  }
}
void loadMemberNavigation();
