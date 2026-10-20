for (const toggle of document.querySelectorAll<HTMLButtonElement>('[data-password-toggle]')) {
  const input = document.getElementById(toggle.dataset.passwordToggle!) as HTMLInputElement | null;
  if (!input) continue;
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute(
      'aria-label',
      `${show ? 'Hide' : 'Show'} ${input.labels?.[0]?.textContent?.trim().toLowerCase() ?? 'password'}`,
    );
  });
  input.addEventListener('keyup', (event) => {
    const hint = document.querySelector<HTMLElement>(`[data-caps-lock="${input.id}"]`);
    if (hint) hint.hidden = !event.getModifierState('CapsLock');
  });
  input.addEventListener('blur', () => {
    const hint = document.querySelector<HTMLElement>(`[data-caps-lock="${input.id}"]`);
    if (hint) hint.hidden = true;
  });
}
