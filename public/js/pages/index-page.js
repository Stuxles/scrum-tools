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
  const createName     = document.getElementById('create-name');
  const joinName       = document.getElementById('join-name');
  const roomNameInput  = document.getElementById('room-name');
  const deckTypeSelect = document.getElementById('deck-type');
  const customField    = document.getElementById('custom-cards-field');
  const customCards    = document.getElementById('custom-cards');
  const createBtn      = document.getElementById('create-room-btn');
  const joinCodeInput  = document.getElementById('join-code');
  const joinBtn        = document.getElementById('join-room-btn');
  const createTab      = document.getElementById('create-tab');
  const joinTab        = document.getElementById('join-tab');
  const createPanel    = document.getElementById('create-panel');
  const joinPanel      = document.getElementById('join-panel');

  // Pre-fill saved name
  const saved = getSavedName();
  if (saved) { createName.value = saved; joinName.value = saved; }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function switchTab(tab) {
    const isCreate = tab === 'create';
    createTab.classList.toggle('active',  isCreate);
    joinTab.classList.toggle('active',    !isCreate);
    createTab.setAttribute('aria-selected', String(isCreate));
    joinTab.setAttribute('aria-selected',   String(!isCreate));
    createPanel.classList.toggle('hidden', !isCreate);
    joinPanel.classList.toggle('hidden',    isCreate);
  }
  createTab.addEventListener('click', () => switchTab('create'));
  joinTab.addEventListener('click',   () => switchTab('join'));

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
    const name     = createName.value.trim();
    const deckType = deckTypeSelect.value;
    const roomName = roomNameInput.value.trim();

    if (!name) { toast(t('toast-enter-name'), 'error'); createName.focus(); return; }

    let custom = [];
    if (deckType === 'custom') {
      custom = customCards.value.split(',').map(s => s.trim()).filter(Boolean);
      if (custom.length < 2) {
        toast(t('toast-min-cards'), 'error');
        customCards.focus();
        return;
      }
    }

    saveName(name);
    createBtn.disabled    = true;
    createBtn.textContent = t('btn-creating');
    socket.emit('create-room', { name, deckType, customCards: custom, roomName });

    setTimeout(() => {
      if (createBtn.disabled) {
        createBtn.disabled    = false;
        createBtn.textContent = t('btn-create');
        toast(t('toast-server-offline'), 'error');
      }
    }, 10_000);
  }

  createBtn.addEventListener('click', doCreate);
  createName.addEventListener('keydown',    e => { if (e.key === 'Enter') doCreate(); });
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

  // ── Socket events ─────────────────────────────────────────────────────────
  socket.on('room-created', ({ roomId }) => {
    localStorage.setItem('scrum_auto_join_room', roomId);
    window.location.href = `/room.html?id=${roomId}`;
  });

  socket.on('room-joined', ({ room }) => {
    window.location.href = `/room.html?id=${room.id}`;
  });

  socket.on('error', ({ message }) => {
    toast(message, 'error');
    createBtn.disabled    = false;
    createBtn.textContent = t('btn-create');
    joinBtn.disabled      = false;
    joinBtn.textContent   = t('btn-join');
  });
}
