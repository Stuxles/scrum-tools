/**
 * Theme cycle.
 * Reads initial state from <html data-theme>, persists choice to localStorage.
 * Exposes a callback hook so QR code can reload when theme changes.
 */

import { t } from './utils/i18n.js';

/** Cycle order. The button advertises the theme it would switch *to*.
    First entry is the default: it is what `normalizeTheme` falls back to and
    what the inline bootstrap in each page head applies when nothing is
    stored. Changing the order changes the default — keep the two in step. */
const ORDER = ['coral', 'dark', 'light'];
const THEMES = {
  dark:  { icon: '🌙', label: 'theme-dark',  sub: 'theme-mode-dark'  },
  light: { icon: '☀️', label: 'theme-light', sub: 'theme-mode-light' },
  coral: { icon: '🪸', label: 'theme-coral', sub: 'theme-mode-coral' },
};

/** The stored theme is user-writable, so anything unknown reads as the first.
    Tested against ORDER, not THEMES: `THEMES['constructor']` is truthy. */
export function normalizeTheme(mode) {
  return ORDER.includes(mode) ? mode : ORDER[0];
}

/** Next theme in the cycle, wrapping at the end. */
export function nextTheme(mode) {
  return ORDER[(ORDER.indexOf(normalizeTheme(mode)) + 1) % ORDER.length];
}

function current() {
  return normalizeTheme(document.documentElement.getAttribute('data-theme'));
}

/** @type {Function|null} */
let _onThemeChange = null;

/** @param {Function} cb  Called with the new theme string. */
export function onThemeChange(cb) {
  _onThemeChange = cb;
}

export function initThemeToggle() {
  const btn  = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  if (!btn || !icon) return;

  const update = (mode) => {
    const next = THEMES[nextTheme(mode)];
    icon.textContent = next.icon;
    const label = document.getElementById('theme-label');
    if (label) label.textContent = t(next.label);
    const subTheme = document.getElementById('options-sub-theme');
    if (subTheme) subTheme.textContent = t(THEMES[mode].sub);
  };
  update(current());

  btn.addEventListener('click', () => {
    const mode = nextTheme(current());
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('scrumpoker_theme', mode);
    update(mode);
    _onThemeChange?.(mode);
  });

  window.addEventListener('lang-changed', () => {
    update(current());
  });
}
