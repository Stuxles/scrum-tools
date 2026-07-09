/**
 * Application entrypoint — loaded as <script type="module">.
 *
 * Detects the current page and boots the correct sub-module.
 * Also initialises the shared theme toggle.
 */

import { initThemeToggle }  from './theme.js';
import { initIndexPage }    from './pages/index-page.js';
import { initRoomPage }     from './room/room-page.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // socket.io is loaded globally via <script> tag in HTML
  // eslint-disable-next-line no-undef
  const socket = io({ transports: ['websocket', 'polling'] });

  const urlParams  = new URLSearchParams(window.location.search);
  const urlRoomId  = (urlParams.get('id') || '').toUpperCase();
  const isRoomPage = window.location.pathname.includes('room.html');

  initThemeToggle();

  if (isRoomPage) {
    initRoomPage(socket, urlRoomId);
  } else {
    initIndexPage(socket, urlRoomId);
  }
});
