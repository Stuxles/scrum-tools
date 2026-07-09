/**
 * Application entrypoint — loaded as <script type="module">.
 *
 * Detects the current page and boots the correct sub-module.
 * Also initialises the shared theme toggle.
 */

import { initThemeToggle }  from './theme.js';
import { initIndexPage }    from './pages/index-page.js';
import { initRoomPage }     from './room/room-page.js';

// ── Shared socket connection ──────────────────────────────────────────────────
// socket.io is still loaded as a traditional <script> tag so `io` is global.
// eslint-disable-next-line no-undef
const socket = io({ transports: ['websocket', 'polling'] });

// ── URL params ────────────────────────────────────────────────────────────────
const urlParams  = new URLSearchParams(window.location.search);
const urlRoomId  = (urlParams.get('id') || '').toUpperCase();
const isRoomPage = window.location.pathname.includes('room.html');

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();

  if (isRoomPage) {
    initRoomPage(socket, urlRoomId);
  } else {
    initIndexPage(socket, urlRoomId);
  }
});
