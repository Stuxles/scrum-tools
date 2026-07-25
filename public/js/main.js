/**
 * Application entrypoint — loaded as <script type="module">.
 *
 * Detects the current page and boots the correct sub-module.
 * Also initialises the shared theme toggle.
 */

import { initThemeToggle }  from './theme.js';
import { initI18n }         from './utils/i18n.js';
import { initIndexPage }    from './pages/index-page.js';
import { initRoomPage }     from './room/room-page.js';
import { applyAustraliaMode, getAustraliaModeEnabled } from './utils/helpers.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // The <head> boot script already set the class for a flash-free first
  // paint; mirror it onto <body> as an inline style now that it exists, so
  // the state matches whatever a later toggle will write. See helpers.js.
  applyAustraliaMode(getAustraliaModeEnabled());

  const urlParams  = new URLSearchParams(window.location.search);
  const urlRoomId  = (urlParams.get('id') || '').toUpperCase();
  const isRoomPage = window.location.pathname.includes('room.html');

  // The room page needs a live connection immediately; the index page only
  // needs one if the visitor actually creates a room (joining navigates to
  // room.html). Connecting eagerly there opened a socket for every passer-by
  // and filled the log with connect/disconnect pairs that never touched a
  // room, so the index page connects on demand instead.
  // socket.io is loaded globally via <script> tag in HTML
  // eslint-disable-next-line no-undef
  const socket = io({ transports: ['websocket', 'polling'], autoConnect: isRoomPage });

  initI18n();
  initThemeToggle();

  if (isRoomPage) {
    initRoomPage(socket, urlRoomId);
  } else {
    initIndexPage(socket, urlRoomId);
  }
});
