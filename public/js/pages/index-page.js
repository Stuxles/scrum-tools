/**
 * Index page logic — create-room and join-room forms.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} urlRoomId  Pre-filled room code from URL (may be empty).
 */

import { toast }                    from '../utils/toast.js';
import { getSavedName, saveName }   from '../utils/helpers.js';
import { t }                        from '../utils/i18n.js';

export function initIndexPage(socket, urlRoomId) {
  const joinName       = document.getElementById('join-name');
  const roomNameInput  = document.getElementById('room-name');
  const deckTypeSelect = document.getElementById('deck-type');
  const customField    = document.getElementById('custom-cards-field');
  const customCards    = document.getElementById('custom-cards');
  const createBtn      = document.getElementById('create-room-btn');
  const joinCodeInput  = document.getElementById('join-code');
  const joinBtn        = document.getElementById('join-room-btn');
  const presentCode    = document.getElementById('present-code');
  const presentBtn     = document.getElementById('present-room-btn');
  const createTab      = document.getElementById('create-tab');
  const joinTab        = document.getElementById('join-tab');
  const presentTab     = document.getElementById('present-tab');
  const createPanel    = document.getElementById('create-panel');
  const joinPanel      = document.getElementById('join-panel');
  const presentPanel   = document.getElementById('present-panel');

  // Only the join tab asks who you are. Creating a room sets up the presenter
  // screen, and a screen has no name.
  const saved = getSavedName();
  if (saved) joinName.value = saved;

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const TABS = {
    create:  { tab: createTab,  panel: createPanel },
    join:    { tab: joinTab,    panel: joinPanel },
    present: { tab: presentTab, panel: presentPanel },
  };

  function switchTab(name) {
    for (const [key, { tab, panel }] of Object.entries(TABS)) {
      const active = key === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      panel.classList.toggle('hidden', !active);
    }
  }
  for (const [name, { tab }] of Object.entries(TABS)) {
    tab.addEventListener('click', () => switchTab(name));
  }

  // Pre-fill join tab when room code is in URL
  if (urlRoomId) {
    if (joinCodeInput) joinCodeInput.value = urlRoomId;
    switchTab('join');
    joinName.focus();
  }

  // ── Custom deck field toggle ───────────────────────────────────────────────
  deckTypeSelect.addEventListener('change', () => {
    customField.classList.toggle('hidden', deckTypeSelect.value !== 'custom');
  });

  // ── Create room ───────────────────────────────────────────────────────────
  function doCreate() {
    const deckType = deckTypeSelect.value;
    const roomName = roomNameInput.value.trim();

    let custom = [];
    if (deckType === 'custom') {
      custom = customCards.value.split(',').map(s => s.trim()).filter(Boolean);
      if (custom.length < 2) {
        toast(t('toast-min-cards'), 'error');
        customCards.focus();
        return;
      }
    }

    createBtn.disabled    = true;
    createBtn.textContent = t('btn-creating');

    // The socket is created with autoConnect:false on this page (see main.js),
    // so open it here and send once it is actually up. Emitting straight away
    // would rely on socket.io's internal buffering; waiting for `connect` is
    // explicit and cannot silently drop the packet.
    const payload = { deckType, customCards: custom, roomName };
    if (socket.connected) {
      socket.emit('create-room', payload);
    } else {
      socket.once('connect', () => socket.emit('create-room', payload));
      socket.connect();
    }

    setTimeout(() => {
      if (createBtn.disabled) {
        createBtn.disabled    = false;
        createBtn.textContent = t('btn-create');
        toast(t('toast-server-offline'), 'error');
      }
    }, 10_000);
  }

  createBtn.addEventListener('click', doCreate);
  roomNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doCreate(); });

  // ── Join room ─────────────────────────────────────────────────────────────
  function doJoin() {
    const name = joinName.value.trim();
    const code = joinCodeInput.value.trim().toUpperCase();

    if (!name) { toast(t('toast-enter-name'), 'error'); joinName.focus();      return; }
    if (!code) { toast(t('toast-enter-code'), 'error'); joinCodeInput.focus(); return; }

    saveName(name);
    joinBtn.disabled    = true;
    joinBtn.textContent = t('btn-continuing');
    window.location.href = `/room.html?id=${encodeURIComponent(code)}`;
  }

  joinBtn.addEventListener('click', doJoin);
  joinCodeInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
  joinName.addEventListener('keydown',      e => { if (e.key === 'Enter') doJoin(); });
  joinCodeInput.addEventListener('input',   () => { joinCodeInput.value = joinCodeInput.value.toUpperCase(); });

  // ── Present an existing room ──────────────────────────────────────────────
  async function doPresent() {
    const code = presentCode.value.trim().toUpperCase();
    if (!code) { toast(t('toast-enter-code'), 'error'); presentCode.focus(); return; }

    presentBtn.disabled    = true;
    presentBtn.textContent = t('btn-continuing');

    // Check the room exists before navigating, so a typo is caught here rather
    // than on a presenter screen someone already pointed at a projector.
    try {
      const res  = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!data.exists) throw new Error('not found');
      window.location.href = `/presenter.html?id=${encodeURIComponent(code)}`;
    } catch {
      toast(t('toast-room-not-found', { id: code }), 'error');
      presentBtn.disabled    = false;
      presentBtn.textContent = t('btn-present');
      presentCode.focus();
    }
  }

  presentBtn.addEventListener('click', doPresent);
  presentCode.addEventListener('keydown', e => { if (e.key === 'Enter') doPresent(); });
  presentCode.addEventListener('input',   () => { presentCode.value = presentCode.value.toUpperCase(); });

  // ── Socket events ─────────────────────────────────────────────────────────
  // Creating a room opens the presenter screen for it: the creator is setting
  // up a display, not taking a seat. Joining is a separate, deliberate act.
  socket.on('room-created', ({ roomId }) => {
    window.location.href = `/presenter.html?id=${roomId}`;
  });

  socket.on('error', ({ message }) => {
    toast(message, 'error');
    createBtn.disabled    = false;
    createBtn.textContent = t('btn-create');
    joinBtn.disabled      = false;
    joinBtn.textContent   = t('btn-join');
  });
}
