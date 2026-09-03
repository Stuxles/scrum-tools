/**
 * Presenter screen — the facilitator's dashboard.
 *
 * A screen, not a person: it attaches with `watch-room`, never appears in the
 * participant list, and holds no vote or seat. It does drive the room though
 * (reveal, new round, deck, story title), because running the session from
 * the big screen while estimating from your own phone is the entire point.
 * The server authorises it through `canControlRoom()`.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} urlRoomId
 */

import { toast }              from '../utils/toast.js';
import { t }                  from '../utils/i18n.js';
import { onThemeChange }      from '../theme.js';
import { getConfettiEnabled, setConfettiEnabled, getAustraliaModeEnabled, setAustraliaModeEnabled, applyAustraliaMode } from '../utils/helpers.js';
import { renderParticipants } from '../room/render-users.js';
import { renderResults }      from '../room/render-results.js';
import { computeVoteStats, isUnanimousConsensus, eligibleVoters } from '../utils/stats.js';
import { celebrateConsensus } from '../utils/confetti.js';

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
  const side            = document.getElementById('presenter-side');
  const sideToggle      = document.getElementById('presenter-side-toggle');
  const sideToggleGlyph = document.getElementById('presenter-side-toggle-glyph');
  const storyWrap       = document.getElementById('presenter-story');
  const storyAddBtn     = document.getElementById('presenter-story-add');
  const storyInput      = document.getElementById('presenter-story-input');
  const storyClearBtn   = document.getElementById('presenter-story-clear');
  const revealBtn       = document.getElementById('presenter-reveal-btn');
  const resetBtn        = document.getElementById('presenter-reset-btn');
  const autoRevealBtn   = document.getElementById('presenter-auto-reveal-btn');
  const autoRevealLabel = document.getElementById('auto-reveal-label');
  const currentDeck     = document.getElementById('presenter-current-deck');
  const deckBtn         = document.getElementById('presenter-deck-btn');
  const deckModal       = document.getElementById('deck-modal');
  const deckModalType   = document.getElementById('deck-modal-type');
  const deckModalCustom = document.getElementById('deck-modal-custom');
  const deckCustomField = document.getElementById('deck-modal-custom-field');
  const deckModalSave   = document.getElementById('deck-modal-save');
  const deckModalCancel = document.getElementById('deck-modal-cancel');
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
  const optionsBtn      = document.getElementById('presenter-options-btn');
  const optionsModal    = document.getElementById('options-modal');
  const optionsCloseBtn = document.getElementById('options-close-btn');
  const optionsVersion  = document.getElementById('options-version');
  const confettiToggle  = document.getElementById('confetti-toggle');
  const confettiLabel   = document.getElementById('confetti-label');
  const australiaToggle = document.getElementById('australia-toggle');
  const australiaLabel  = document.getElementById('australia-label');

  let currentRoom = null;

  // Naming the ticket is opt-in: plenty of teams never do it, so the field
  // stays collapsed until someone asks for it — or until a title arrives from
  // the server, which means somebody somewhere is using it after all.
  // Fire the consensus burst once per reveal, not on every room-state that
  // arrives while the room stays revealed.
  let hasCelebratedThisReveal = false;

  let storyOpen = false;
  function renderStoryVisibility() {
    const show = storyOpen || Boolean((currentRoom?.storyTitle || '').trim());
    storyWrap.classList.toggle('hidden', !show);
    storyAddBtn.classList.toggle('hidden', show);
  }

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

  // ── Sidebar ───────────────────────────────────────────────────────────────
  // Nothing folds away on its own. A first joiner is no reason to take the QR
  // off the wall — the next person to walk in still needs it. Collapsing is a
  // deliberate "give the cards the room", and nothing is lost by it: reveal
  // and new round are in the header, the rest is in the options modal.
  let sideCollapsed = false;
  function renderSide() {
    side.classList.toggle('hidden', sideCollapsed);
    sideToggle.setAttribute('aria-expanded', String(!sideCollapsed));
    sideToggleGlyph.textContent = sideCollapsed ? '«' : '»';
    const label = t(sideCollapsed ? 'presenter-expand-side' : 'presenter-collapse-side');
    sideToggle.setAttribute('title', label);
    sideToggle.setAttribute('aria-label', label);
  }
  sideToggle.addEventListener('click', () => {
    sideCollapsed = !sideCollapsed;
    renderSide();
  });
  renderSide();

  // ── Controls ──────────────────────────────────────────────────────────────
  const emitRoom = (event, extra = {}) => {
    if (currentRoom) socket.emit(event, { roomId: currentRoom.id, ...extra });
  };

  revealBtn.addEventListener('click', () => emitRoom('reveal'));
  resetBtn.addEventListener('click',  () => emitRoom('reset'));

  // Unlike the other options this one is the room's, not the screen's, so it
  // renders from room state rather than from a local preference.
  function renderAutoReveal() {
    const on = Boolean(currentRoom?.autoReveal);
    autoRevealLabel.textContent = t(on ? 'confetti-on' : 'confetti-off');
    autoRevealBtn.setAttribute('aria-pressed', String(on));
  }
  autoRevealBtn.addEventListener('click', () => {
    const next = !currentRoom?.autoReveal;
    emitRoom('toggle-auto-reveal', { autoReveal: next });
    toast(next ? t('toast-auto-reveal-on') : t('toast-auto-reveal-off'), 'info');
  });

  const saveStory = () => emitRoom('update-story-title', { storyTitle: storyInput.value.trim() });
  storyInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    saveStory();
    storyInput.blur();
    toast(storyInput.value.trim() ? t('story-saved') : t('story-cleared'), 'success');
  });
  storyInput.addEventListener('blur', saveStory);
  storyAddBtn.addEventListener('click', () => {
    storyOpen = true;
    renderStoryVisibility();
    storyInput.focus();
  });
  storyClearBtn.addEventListener('click', () => {
    storyInput.value = '';
    saveStory();
    storyOpen = false;          // collapse again — back out of the opt-in
    renderStoryVisibility();
    toast(t('story-cleared'), 'info');
  });

  const closeDeckModal = () => deckModal.classList.add('hidden');
  deckBtn.addEventListener('click', () => {
    if (!currentRoom) return;
    optionsModal.classList.add('hidden');   // it launched from there; don't stack
    deckModalType.value = currentRoom.deckType || 'standard';
    deckCustomField.classList.toggle('hidden', deckModalType.value !== 'custom');
    deckModal.classList.remove('hidden');
  });
  deckModalType.addEventListener('change', () => {
    deckCustomField.classList.toggle('hidden', deckModalType.value !== 'custom');
  });
  deckModalCancel.addEventListener('click', closeDeckModal);
  deckModal.addEventListener('click', e => { if (e.target === deckModal) closeDeckModal(); });
  deckModalSave.addEventListener('click', () => {
    const deckType = deckModalType.value;
    let cards = [];
    if (deckType === 'custom') {
      cards = deckModalCustom.value.split(',').map(s => s.trim()).filter(Boolean);
      if (cards.length < 2) { toast(t('toast-min-cards'), 'error'); return; }
    }
    emitRoom('change-deck', { deckType, customCards: cards });
    closeDeckModal();
  });

  function deckLabel(type) {
    const labels = {
      standard:  t('deck-standard').split(' — ')[0],
      fibonacci: t('deck-fibonacci').split(' — ')[0],
      tshirt:    t('deck-tshirt').split(' — ')[0],
      custom:    t('deck-custom').replace('…', ''),
    };
    return labels[type] || type;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function applyRoomState(room) {
    currentRoom = room;

    roomName.textContent = room.name;
    roomCode.textContent = room.id;
    onlineCount.textContent = `${room.participants.length}`;

    // Don't fight the facilitator for the caret while they are typing.
    if (document.activeElement !== storyInput) storyInput.value = room.storyTitle || '';
    renderStoryVisibility();

    currentDeck.textContent = deckLabel(room.deckType);
    deckModalType.value     = room.deckType;
    renderAutoReveal();

    const hasPeople = room.participants.length > 0;
    emptyState.classList.toggle('hidden', hasPeople);
    participantsWrap.classList.toggle('hidden', !hasPeople);

    // Kick yes, transfer no — the server draws the same line. `canControlRoom()`
    // lets a screen kick, but `sm-transfer-master` requires the sender to hold
    // the seat being handed over, and a screen holds none.
    renderParticipants(participantsList, room, socket, { canKick: true, canTransfer: false });

    const voters = eligibleVoters(room.participants);
    const voted  = voters.filter(p => p.hasVoted).length;
    const pct    = voters.length > 0 ? Math.round((voted / voters.length) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = t('progress-text', { voted, total: voters.length });
    progressWrap.classList.toggle('hidden', !hasPeople || room.revealed);

    revealBtn.disabled = room.revealed || voted === 0;

    if (room.revealed) {
      // Bigger teams get smaller cards, so a reveal never needs scrolling on a
      // screen nobody can reach. The CSS reads this back as --card-w.
      resultsCardsGrid.dataset.size = voters.length <= 8 ? 'lg' : voters.length <= 16 ? 'md' : 'sm';
      renderResults({ votingPhase, resultsPhase, resultsSubtitle, resultsCardsGrid, resultsStats }, room);

      // The screen is where everyone is already looking, so this is the place
      // to celebrate a unanimous round. The on/off preference is per device,
      // which here means the screen's own — a phone opting out does not stop
      // the room from seeing it, and vice versa.
      if (!hasCelebratedThisReveal) {
        const stats = computeVoteStats(room.participants);
        if (isUnanimousConsensus(stats.votes, voters.length) && getConfettiEnabled()) {
          celebrateConsensus();
        }
        hasCelebratedThisReveal = true; // only ever attempt once per reveal
      }
    } else {
      hasCelebratedThisReveal = false;
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

  socket.on('error', ({ message }) => {
    toast(message, 'error');
    // A bookmarked screen whose room has since been cleaned up would otherwise
    // sit on an empty page with nothing but a toast that fades after three
    // seconds. Show the same dead-end as a room closing under us.
    if (!currentRoom) closedOverlay.classList.remove('hidden');
  });

  // Re-attach on every established connection, the same way the room page
  // re-joins: `connect` covers socket.io's own reconnect as well as a manual
  // one, where the manager-level `reconnect` event covers only the former.
  socket.on('connect', watch);
  if (socket.connected) watch();

  socket.io.on('reconnect', () => toast(t('toast-reconnected'), 'success'));

  loadQR();

  // ── Options ───────────────────────────────────────────────────────────────
  optionsBtn.addEventListener('click', () => optionsModal.classList.remove('hidden'));
  optionsCloseBtn.addEventListener('click', () => optionsModal.classList.add('hidden'));
  optionsModal.addEventListener('click', e => { if (e.target === optionsModal) optionsModal.classList.add('hidden'); });

  function renderConfettiToggle() {
    confettiLabel.textContent = getConfettiEnabled() ? t('confetti-on') : t('confetti-off');
    confettiToggle.setAttribute('aria-pressed', String(getConfettiEnabled()));
  }
  confettiToggle.addEventListener('click', () => {
    setConfettiEnabled(!getConfettiEnabled());
    renderConfettiToggle();
  });

  function renderAustraliaToggle() {
    australiaLabel.textContent = getAustraliaModeEnabled() ? t('confetti-on') : t('confetti-off');
    australiaToggle.setAttribute('aria-pressed', String(getAustraliaModeEnabled()));
  }
  australiaToggle.addEventListener('click', () => {
    const enabled = !getAustraliaModeEnabled();
    setAustraliaModeEnabled(enabled);
    applyAustraliaMode(enabled);
    renderAustraliaToggle();
  });

  renderConfettiToggle();
  renderAustraliaToggle();

  let appVersion = null;
  const renderVersion = () => {
    if (appVersion) optionsVersion.textContent = `${t('options-version-label')} ${appVersion}`;
  };
  fetch('/api/config')
    .then(r => r.json())
    .then(data => { if (data.version) { appVersion = data.version; renderVersion(); } })
    .catch(() => {});

  window.addEventListener('lang-changed', () => {
    if (currentRoom) applyRoomState(currentRoom);
    renderSide();
    renderConfettiToggle();
    renderAustraliaToggle();
    renderVersion();
  });
}
