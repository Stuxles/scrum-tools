/**
 * Application entrypoint — loaded as <script type="module">.
 *
 * Detects the current page and boots the correct sub-module.
 * Also initialises the shared theme toggle.
 */

import { initThemeToggle }  from './theme.js';
import { initI18n }         from './utils/i18n.js';
import { initIndexPage }    from './pages/index-page.js';
import { initPresenterPage } from './pages/presenter-page.js';
import { initRoomPage }     from './room/room-page.js';
import { applyAustraliaMode, getAustraliaModeEnabled } from './utils/helpers.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // The <head> boot script already set the class for a flash-free first
  // paint; mirror it onto <body> as an inline style now that it exists, so
  // the state matches whatever a later toggle will write. See helpers.js.
  applyAustraliaMode(getAustraliaModeEnabled());

  const urlParams       = new URLSearchParams(window.location.search);
  const urlRoomId       = (urlParams.get('id') || '').toUpperCase();
  const path            = window.location.pathname;
  const isPresenterPage = path.includes('presenter.html');
  const isRoomPage      = path.includes('room.html');

  // The room and presenter pages need a live connection immediately; the index
  // page only needs one if the visitor actually creates a room (joining
  // navigates away). Connecting eagerly there opened a socket for every
  // passer-by and filled the log with connect/disconnect pairs that never
  // touched a room, so the index page connects on demand instead.
  // socket.io is loaded globally via <script> tag in HTML
  // eslint-disable-next-line no-undef
  const socket = io({ transports: ['websocket', 'polling'], autoConnect: isRoomPage || isPresenterPage });

  initI18n();
  initThemeToggle();

  if (isPresenterPage) {
    initPresenterPage(socket, urlRoomId);
  } else if (isRoomPage) {
    initRoomPage(socket, urlRoomId);
  } else {
    initIndexPage(socket, urlRoomId);
  }
});
