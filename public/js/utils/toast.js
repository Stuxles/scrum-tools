/**
 * Toast notification system.
 * Appends a self-removing toast to #toast-container.
 *
 * @param {string} msg
 * @param {'info'|'success'|'error'} [type='info']
 * @param {number} [duration=3000]
 */
import { translateServerMsg } from './i18n.js';

export function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className   = `toast toast-${type}`;
  el.textContent = translateServerMsg(msg);
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}
