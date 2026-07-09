/** localStorage key for persisting the user's display name. */
export const LS_NAME = 'scrumpoker_name';

/** @returns {string} */
export const getSavedName = () => localStorage.getItem(LS_NAME) || '';

/** @param {string} name */
export const saveName = (name) => { if (name) localStorage.setItem(LS_NAME, name); };

/**
 * Escape HTML special characters to prevent XSS in innerHTML contexts.
 * @param {string} str
 * @returns {string}
 */
export function escHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/**
 * Copy text to clipboard. Prefers the modern Clipboard API and falls back
 * to a hidden textarea (then a prompt) for insecure HTTP contexts like LAN IPs.
 *
 * @param {string}   text
 * @param {Function} onSuccess  Called with no args on success.
 * @param {Function} onFallback Called with no args when prompt is shown.
 */
export async function copyToClipboard(text, onSuccess, onFallback) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      onSuccess?.();
      return;
    }
    throw new Error('Fallback');
  } catch {
    const ta = document.createElement('textarea');
    ta.value           = text;
    ta.style.position  = 'fixed';
    ta.style.left      = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      onSuccess?.();
    } catch {
      prompt('Kopieer handmatig:', text);
      onFallback?.();
    }
    ta.remove();
  }
}
