/**
 * Theme picker.
 * Reads initial state from <html data-theme>, persists choice to localStorage.
 * Exposes a callback hook so QR code can reload when theme changes.
 */

import { t } from './utils/i18n.js';

/** The themes, in the order the picker lists them.
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

function current() {
  return normalizeTheme(document.documentElement.getAttribute('data-theme'));
}

/** @type {Function|null} */
let _onThemeChange = null;

/** @param {Function} cb  Called with the new theme string. */
export function onThemeChange(cb) {
  _onThemeChange = cb;
}

export function initThemePicker() {
  const select = document.getElementById('theme-select');
  if (!select) return;

  // Options are built here rather than written out in all three pages: the
  // list, the icons and the labels then have one source, and the labels have
  // to be re-rendered on a language switch anyway.
  const render = () => {
    const mode = current();
    select.replaceChildren(...ORDER.map((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${THEMES[name].icon} ${t(THEMES[name].label)}`;
      return opt;
    }));
    select.value = mode;
    const subTheme = document.getElementById('options-sub-theme');
    if (subTheme) subTheme.textContent = t(THEMES[mode].sub);
  };
  render();

  select.addEventListener('change', () => {
    // Through normalizeTheme, so a value that is not one of ours cannot reach
    // the attribute or localStorage.
    const mode = normalizeTheme(select.value);
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('scrumpoker_theme', mode);
    render();
    _onThemeChange?.(mode);
  });

  window.addEventListener('lang-changed', render);
}
