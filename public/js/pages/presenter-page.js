/**
 * Presenter screen.
 *
 * A screen, not a person: it attaches with `watch-room`, never appears in the
 * participant list, and holds no vote, seat or role. Read-only by design —
 * every control lives with the host, on their own device.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} urlRoomId
 */

import { toast }              from '../utils/toast.js';
import { t }                  from '../utils/i18n.js';
import { onThemeChange }      from '../theme.js';
import { renderParticipants } from '../room/render-users.js';
import { renderResults }      from '../room/render-results.js';

export function initPresenterPage(socket, urlRoomId) {
  if (!urlRoomId) {
    window.location.replace('/');
    return;
  }

  const roomName        = document.getElementById('presenter-room-name');
  const roomCode        = document.getElementById('presenter-code');
  const onlineCount     = document.getElementById('presenter-online-count');
  const qrImg           = document.getElementById('presenter-qr');
  const qrPlaceholder   = document.getElementById('presenter-qr-placeholder');
  const qrUrl           = document.getElementById('presenter-url');
  const storyWrap       = document.getElementById('presenter-story');
  const storyText       = document.getElementById('presenter-story-text');
  const progressWrap    = document.getElementById('presenter-progress-wrap');
  const progressFill    = document.getElementById('presenter-progress-fill');
  const progressText    = document.getElementById('presenter-progress-text');
  const emptyState      = document.getElementById('presenter-empty');
  const participantsWrap = document.getElementById('presenter-participants-wrap');
  const participantsList = document.getElementById('participants-list');
  const resultsPhase    = document.getElementById('results-phase');
  const votingPhase     = document.getElementById('voting-phase');
  const resultsSubtitle = document.getElementById('results-subtitle');
  const resultsCardsGrid = document.getElementById('results-cards-grid');
  const resultsStats    = document.getElementById('results-stats');
  const closedOverlay   = document.getElementById('presenter-closed');

  let currentRoom = null;

  // ── QR ────────────────────────────────────────────────────────────────────
  // Fetched here rather than through qr-module.js: that module drives the
  // share modal and expects a handful of elements this page has no use for.
  async function loadQR() {
    try {
      const baseUrl = encodeURIComponent(window.location.origin);
      const theme   = document.documentElement.getAttribute('data-theme') || 'dark';
      const res     = await fetch(`/api/rooms/${urlRoomId}/qr?baseUrl=${baseUrl}&theme=${theme}`);
      const data    = await res.json();
      if (!data.qr) throw new Error('no qr');

      qrImg.src = data.qr;
      qrImg.classList.remove('hidden');
      qrPlaceholder.classList.add('hidden');
      qrUrl.textContent = data.url;
    } catch {
      qrPlaceholder.textContent = t('qr-not-available');
    }
  }

  onThemeChange(() => loadQR());

  // ── Render ────────────────────────────────────────────────────────────────
  function applyRoomState(room) {
    currentRoom = room;

    roomName.textContent = room.name;
    roomCode.textContent = room.id;
    onlineCount.textContent = `${room.participants.length}`;

    const story = (room.storyTitle || '').trim();
    storyWrap.classList.toggle('hidden', !story);
    storyText.textContent = story;

    const hasPeople = room.participants.length > 0;
    emptyState.classList.toggle('hidden', hasPeople);
    participantsWrap.classList.toggle('hidden', !hasPeople);

    // `isMaster` is false: a screen never renders kick or transfer buttons.
    renderParticipants(participantsList, room, false, socket);

    const voters = room.participants.filter(p => !p.isSpectator);
    const voted  = voters.filter(p => p.hasVoted).length;
    const pct    = voters.length > 0 ? Math.round((voted / voters.length) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = t('progress-text', { voted, total: voters.length });
    progressWrap.classList.toggle('hidden', !hasPeople || room.revealed);

    if (room.revealed) {
      renderResults({ votingPhase, resultsPhase, resultsSubtitle, resultsCardsGrid, resultsStats }, room);
    } else {
      resultsPhase.classList.add('hidden');
    }
  }

  // ── Socket ────────────────────────────────────────────────────────────────
  const watch = () => socket.emit('watch-room', { roomId: urlRoomId });

  socket.on('room-watched', ({ room }) => applyRoomState(room));
  socket.on('room-state',   ({ room }) => applyRoomState(room));

  socket.on('room-closed', () => {
    currentRoom = null;
    closedOverlay.classList.remove('hidden');
  });

  socket.on('error', ({ message }) => toast(message, 'error'));

  // Re-attach on every established connection, the same way the room page
  // re-joins: `connect` covers socket.io's own reconnect as well as a manual
  // one, where the manager-level `reconnect` event covers only the former.
  socket.on('connect', watch);
  if (socket.connected) watch();

  socket.io.on('reconnect', () => toast(t('toast-reconnected'), 'success'));

  loadQR();

  window.addEventListener('lang-changed', () => {
    if (currentRoom) applyRoomState(currentRoom);
  });
}
