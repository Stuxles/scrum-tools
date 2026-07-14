/** localStorage key for persisting the user's display name. */
export const LS_NAME = 'stuxpoker_name';

/** @returns {string} */
export const getSavedName = () => localStorage.getItem(LS_NAME) || localStorage.getItem('scrumpoker_name') || '';

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
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;')
    .replace(/`/g,  '&#x60;');
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

/**
 * Screen Wake Lock API management.
 * Prevents mobile devices from going to sleep during active planning sessions.
 */
let wakeLock = null;

export async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      if (wakeLock === null && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      }
    } catch (err) {
      // Wake lock request failed (e.g. low battery mode or tab not active)
    }
  }
}

export function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window._isInScrumRoom) {
      requestWakeLock();
      if (window._scrumSocket && window._scrumRoomId) {
        if (window._scrumSocket.disconnected) {
          window._scrumSocket.connect();
        } else {
          window._scrumSocket.emit('join-room', { roomId: window._scrumRoomId, name: getSavedName() || 'Anoniem' });
        }
      }
    } else if (document.visibilityState === 'hidden') {
      releaseWakeLock();
    }
  });
}
