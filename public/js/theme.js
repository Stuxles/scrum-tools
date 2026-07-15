/**
 * Dark / light theme toggle.
 * Reads initial state from <html data-theme>, persists choice to localStorage.
 * Exposes a callback hook so QR code can reload when theme changes.
 */

import { t } from './utils/i18n.js';

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

  const update = (mode) => {
    icon.textContent = mode === 'light' ? '🌙' : '☀️';
    const label = document.getElementById('theme-label');
    if (label) label.textContent = mode === 'light' ? t('theme-dark') : t('theme-light');
    const subTheme = document.getElementById('options-sub-theme');
    if (subTheme) subTheme.textContent = mode === 'light' ? t('theme-mode-light') : t('theme-mode-dark');
  };
  update(document.documentElement.getAttribute('data-theme') || 'dark');

  btn.addEventListener('click', () => {
    const mode = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('scrumpoker_theme', mode);
    update(mode);
    _onThemeChange?.(mode);
  });

  window.addEventListener('lang-changed', () => {
    update(document.documentElement.getAttribute('data-theme') || 'dark');
  });
}
