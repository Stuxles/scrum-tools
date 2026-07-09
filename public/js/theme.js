/**
 * Dark / light theme toggle.
 * Reads initial state from <html data-theme>, persists choice to localStorage.
 * Exposes a callback hook so QR code can reload when theme changes.
 */

/** @type {Function|null} */
let _onThemeChange = null;

/** @param {Function} cb  Called with the new theme string ('dark'|'light'). */
export function onThemeChange(cb) {
  _onThemeChange = cb;
}

export function initThemeToggle() {
  const btn  = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  if (!btn || !icon) return;

  const update = (t) => { icon.textContent = t === 'light' ? '🌙' : '☀️'; };
  update(document.documentElement.getAttribute('data-theme') || 'dark');

  btn.addEventListener('click', () => {
    const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('scrumpoker_theme', t);
    update(t);
    _onThemeChange?.(t);
  });
}
