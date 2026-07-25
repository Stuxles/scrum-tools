/**
 * Room page coordinator.
 * Boots up all sub-modules, wires socket events, and owns the shared state.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} urlRoomId
 */

import { toast }                    from '../utils/toast.js';
import { getSavedName, saveName, getSessionToken, setSessionToken, copyToClipboard, requestWakeLock, releaseWakeLock, getConfettiEnabled, setConfettiEnabled, getAustraliaModeEnabled, setAustraliaModeEnabled, applyAustraliaMode } from '../utils/helpers.js';
import { onThemeChange }            from '../theme.js';
import { t }                        from '../utils/i18n.js';
import { renderVoting, selectVoteCard } from './render-voting.js';
import { renderResults }            from './render-results.js';
import { renderParticipants }       from './render-users.js';
import { initQrModule }             from './qr-module.js';
import { computeVoteStats, isUnanimousConsensus } from '../utils/stats.js';
import { celebrateConsensus }       from '../utils/confetti.js';

export function initRoomPage(socket, urlRoomId) {
  if (!urlRoomId) {
    window.location.replace('/');
    return;
  }

  // ── Shared state ──────────────────────────────────────────────────────────
  let isMaster    = false;
  let myVote      = null;
  let currentRoom = null;
  let isRevealing = false;
  let hasCelebratedThisReveal = false; // guards the confetti burst to fire once per reveal

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const joinModal        = document.getElementById('join-modal');
  const joinModalRoom    = document.getElementById('join-modal-room');
  const modalNameInput   = document.getElementById('modal-name');
  const modalJoinBtn     = document.getElementById('modal-join-btn');
  const modalSpectatorChk= document.getElementById('modal-spectator-chk');
  const roomUi           = document.getElementById('room-ui');

  const headerRoomName   = document.getElementById('header-room-name');
  const headerRoomCode   = document.getElementById('header-room-code');
  const roomCodeText     = document.getElementById('room-code-text');
  const headerOnline     = document.getElementById('header-online-count');
  const headerQrBtn      = document.getElementById('header-qr-btn');
  const headerDeckBtn    = document.getElementById('header-deck-btn');
  const headerLeaveBtn   = document.getElementById('header-leave-btn');
  const headerOptionsBtn = document.getElementById('header-options-btn');
  const optionsModal     = document.getElementById('options-modal');
  const optionsCloseBtn  = document.getElementById('options-close-btn');
  const optionsCurrentName = document.getElementById('options-current-name');
  const optionsCurrentRole = document.getElementById('options-current-role');
  const optionsRowClaimSm  = document.getElementById('options-row-claim-sm');
  const optionsRowSpectator = document.getElementById('options-row-spectator');
  const optionsVersion   = document.getElementById('options-version');
  const confettiToggle   = document.getElementById('confetti-toggle');
  const confettiLabel    = document.getElementById('confetti-label');
  const australiaToggle  = document.getElementById('australia-toggle');
  const australiaLabel   = document.getElementById('australia-label');

  const btnClaimSm       = document.getElementById('btn-claim-sm');
  const headerSpectatorBtn  = document.getElementById('header-spectator-btn');
  const headerSpectatorIcon = document.getElementById('header-spectator-icon');
  const headerSpectatorText = document.getElementById('header-spectator-text');
  const headerNameBtn    = document.getElementById('header-name-btn');
  const headerMyName     = document.getElementById('header-my-name');
  const btnSwitchToVoter = document.getElementById('btn-switch-to-voter');

  const participantsList = document.getElementById('participants-list');
  const cardDeck         = document.getElementById('card-deck');
  const presenterBanner  = document.getElementById('presenter-banner');
  const deckWrapper      = document.getElementById('deck-wrapper');

  const storyBanner        = document.getElementById('story-banner');
  const storyBannerEditor  = document.getElementById('story-banner-editor');
  const storyTitleDisplay  = document.getElementById('story-title-display');
  const storyTitleInput    = document.getElementById('story-title-input');
  const storyBtnSave       = document.getElementById('story-btn-save');
  const storyBtnClear      = document.getElementById('story-btn-clear');

  const votingPhase      = document.getElementById('voting-phase');
  const votingPhaseTitle = document.getElementById('voting-phase-title');
  const votingPhaseSub   = document.getElementById('voting-phase-subtitle');
  const voteStatusBar    = document.getElementById('vote-status-bar');
  const voteStatusText   = document.getElementById('vote-status-text');

  const resultsPhase     = document.getElementById('results-phase');
  const resultsSubtitle  = document.getElementById('results-subtitle');
  const resultsCardsGrid = document.getElementById('results-cards-grid');
  const resultsStats     = document.getElementById('results-stats');

  const smPanel          = document.getElementById('sm-panel');
  const smRevealBtn      = document.getElementById('sm-reveal-btn');
  const smResetBtn       = document.getElementById('sm-reset-btn');
  const smProgressFill   = document.getElementById('sm-progress-fill');
  const smProgressText   = document.getElementById('sm-progress-text');
  const smAutoRevealChk  = document.getElementById('sm-auto-reveal-chk');
  const smCurrentDeck    = document.getElementById('sm-current-deck');
  const smChangeDeckBtn  = document.getElementById('sm-change-deck-btn');
  const smQrImg          = document.getElementById('sm-qr-img');
  const smQrPlaceholder  = document.getElementById('qr-placeholder');
  const smQrUrl          = document.getElementById('sm-qr-url');
  const smCopyLinkBtn    = document.getElementById('sm-copy-link-btn');

  const mobileSMBar      = document.getElementById('mobile-sm-bar');
  const mobileRevealBtn  = document.getElementById('mobile-reveal-btn');
  const mobileResetBtn   = document.getElementById('mobile-reset-btn');
  const mobileQrBtn      = document.getElementById('mobile-qr-btn');
  const mobileDeckBtn    = document.getElementById('mobile-deck-btn');

  const nameModal        = document.getElementById('name-modal');
  const nameModalInput   = document.getElementById('name-modal-input');
  const nameModalSave    = document.getElementById('name-modal-save');
  const nameModalCancel  = document.getElementById('name-modal-cancel');

  const qrModal          = document.getElementById('qr-modal');
  const qrModalImg       = document.getElementById('qr-modal-img');
  const qrModalUrl       = document.getElementById('qr-modal-url');
  const qrCopyBtn        = document.getElementById('qr-copy-btn');
  const qrCloseBtn       = document.getElementById('qr-close-btn');

  const deckModal        = document.getElementById('deck-modal');
  const deckModalType    = document.getElementById('deck-modal-type');
  const deckModalCustom  = document.getElementById('deck-modal-custom');
  const deckCustomField  = document.getElementById('deck-modal-custom-field');
  const deckModalSave    = document.getElementById('deck-modal-save');
  const deckModalCancel  = document.getElementById('deck-modal-cancel');

  // ── QR module ─────────────────────────────────────────────────────────────
  const qr = initQrModule({
    smQrImg, smQrPlaceholder, smQrUrl, smCopyLinkBtn,
    qrModal, qrModalImg, qrModalUrl, qrCopyBtn, qrCloseBtn,
    headerQrBtn, mobileQrBtn,
  }, socket, urlRoomId);

  // Reload QR when theme changes (only if SM)
  onThemeChange(() => { if (isMaster) qr.loadQR(); });

  // ── SM controls ───────────────────────────────────────────────────────────
  // Tracks whether we were already rendering as SM, so the (relatively
  // expensive, server-generated) QR code is only re-fetched on the actual
  // transition into the master role — not on every room-state broadcast
  // (which fires on every vote, join, kick, etc. from anyone in the room).
  let smControlsVisible = false;

  function showSMControls() {
    smPanel.classList.remove('hidden');
    mobileSMBar.classList.remove('hidden');
    if (headerQrBtn) headerQrBtn.classList.remove('hidden');
    if (btnClaimSm) btnClaimSm.classList.add('hidden');
    if (optionsRowClaimSm) optionsRowClaimSm.classList.add('hidden');
    if (headerSpectatorBtn) headerSpectatorBtn.classList.add('hidden');
    if (optionsRowSpectator) optionsRowSpectator.classList.add('hidden');
    headerDeckBtn.classList.add('hidden');
    if (storyBanner) storyBanner.classList.remove('hidden');
    if (storyBannerEditor) storyBannerEditor.classList.remove('hidden');
    if (storyTitleDisplay) storyTitleDisplay.classList.add('hidden');
    document.body.classList.add('is-presenter');
    if (!smControlsVisible) {
      qr.loadQR();
      smControlsVisible = true;
    }
  }
  function hideSMControls() {
    smPanel.classList.add('hidden');
    mobileSMBar.classList.add('hidden');
    if (headerQrBtn) headerQrBtn.classList.add('hidden');
    if (btnClaimSm) btnClaimSm.classList.remove('hidden');
    if (optionsRowClaimSm) optionsRowClaimSm.classList.remove('hidden');
    if (headerSpectatorBtn) headerSpectatorBtn.classList.remove('hidden');
    if (optionsRowSpectator) optionsRowSpectator.classList.remove('hidden');
    headerDeckBtn.classList.add('hidden');
    if (storyBanner) storyBanner.classList.remove('hidden');
    if (storyBannerEditor) storyBannerEditor.classList.add('hidden');
    if (storyTitleDisplay) storyTitleDisplay.classList.remove('hidden');
    document.body.classList.remove('is-presenter');
    smControlsVisible = false;
  }

  function saveStoryTitle() {
    if (!currentRoom) return;
    const storyTitle = storyTitleInput?.value.trim() || '';
    socket.emit('update-story-title', { roomId: currentRoom.id, storyTitle });
    toast(storyTitle ? t('story-saved') : t('story-cleared'), 'success');
  }

  if (storyBtnSave) storyBtnSave.addEventListener('click', saveStoryTitle);
  if (storyTitleInput) {
    storyTitleInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveStoryTitle();
        storyTitleInput.blur();
      }
    });
  }
  if (storyBtnClear) {
    storyBtnClear.addEventListener('click', () => {
      if (!currentRoom) return;
      if (storyTitleInput) storyTitleInput.value = '';
      socket.emit('update-story-title', { roomId: currentRoom.id, storyTitle: '' });
      toast(t('story-cleared'), 'info');
    });
  }

  function doReveal() {
    if (!currentRoom || currentRoom.revealed || smRevealBtn.disabled || mobileRevealBtn.disabled || isRevealing) return;
    isRevealing = true;
    currentRoom.revealed = true;
    smRevealBtn.disabled     = true;
    mobileRevealBtn.disabled = true;
    socket.emit('reveal', { roomId: currentRoom.id });
  }

  smRevealBtn.addEventListener('click', doReveal);
  mobileRevealBtn.addEventListener('click', doReveal);

  function doReset() {
    if (!currentRoom) return;
    isRevealing = false;
    myVote = null;
    socket.emit('reset', { roomId: currentRoom.id });
    toast(t('toast-new-round'), 'success');
  }

  smResetBtn.addEventListener('click', doReset);
  mobileResetBtn.addEventListener('click', doReset);

  if (smAutoRevealChk) {
    smAutoRevealChk.addEventListener('change', () => {
      if (!currentRoom) return;
      const enabled = smAutoRevealChk.checked;
      socket.emit('toggle-auto-reveal', { roomId: currentRoom.id, autoReveal: enabled });
      toast(enabled ? t('toast-auto-reveal-on') : t('toast-auto-reveal-off'), 'info');
    });
  }

  // ── Room code copy ────────────────────────────────────────────────────────
  headerRoomCode.addEventListener('click', () => {
    copyToClipboard(
      urlRoomId,
      () => toast(t('toast-code-copied', { id: urlRoomId }), 'success'),
    );
  });

  // ── Deck modal ────────────────────────────────────────────────────────────
  function openDeckModal() {
    if (!currentRoom) return;
    deckModalType.value = currentRoom.deckType || 'standard';
    deckCustomField.classList.toggle('hidden', deckModalType.value !== 'custom');
    deckModal.classList.remove('hidden');
  }

  smChangeDeckBtn.addEventListener('click',  openDeckModal);
  headerDeckBtn.addEventListener('click',    openDeckModal);
  mobileDeckBtn.addEventListener('click',    openDeckModal);
  deckModalCancel.addEventListener('click',  () => deckModal.classList.add('hidden'));
  deckModal.addEventListener('click', e => { if (e.target === deckModal) deckModal.classList.add('hidden'); });
  deckModalType.addEventListener('change',   () => {
    deckCustomField.classList.toggle('hidden', deckModalType.value !== 'custom');
  });

  deckModalSave.addEventListener('click', () => {
    const deckType = deckModalType.value;
    let customCards = [];
    if (deckType === 'custom') {
      customCards = deckModalCustom.value.split(',').map(s => s.trim()).filter(Boolean);
      if (customCards.length < 2) { toast(t('toast-min-cards'), 'error'); return; }
    }
    socket.emit('change-deck', { roomId: currentRoom.id, deckType, customCards });
    deckModal.classList.add('hidden');
    myVote = null;
  });

  // ── Options modal ─────────────────────────────────────────────────────────
  if (headerOptionsBtn && optionsModal) {
    headerOptionsBtn.addEventListener('click', () => {
      optionsModal.classList.remove('hidden');
    });
    if (optionsCloseBtn) optionsCloseBtn.addEventListener('click', () => optionsModal.classList.add('hidden'));
    optionsModal.addEventListener('click', e => { if (e.target === optionsModal) optionsModal.classList.add('hidden'); });
  }

  // ── Name modal ────────────────────────────────────────────────────────────
  headerNameBtn.addEventListener('click', () => {
    if (optionsModal) optionsModal.classList.add('hidden');
    nameModalInput.value = getSavedName();
    nameModal.classList.remove('hidden');
    nameModalInput.focus();
    nameModalInput.select();
  });

  function saveNameChange() {
    const name = nameModalInput.value.trim();
    if (!name) { toast(t('toast-name-empty'), 'error'); return; }
    saveName(name);
    if (currentRoom) socket.emit('update-name', { roomId: currentRoom.id, name });
    nameModal.classList.add('hidden');
    toast(t('toast-name-updated'), 'success');
  }

  nameModalSave.addEventListener('click',   saveNameChange);
  nameModalCancel.addEventListener('click', () => nameModal.classList.add('hidden'));
  nameModalInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveNameChange(); });
  nameModal.addEventListener('click', e => { if (e.target === nameModal) nameModal.classList.add('hidden'); });

  // ── Apply room state ──────────────────────────────────────────────────────
  function getDeckLabel(type) {
    const labels = {
      standard:  t('deck-standard').split(' — ')[0],
      fibonacci: t('deck-fibonacci').split(' — ')[0],
      tshirt:    t('deck-tshirt').split(' — ')[0],
      custom:    t('deck-custom').replace('…', ''),
    };
    return labels[type] || type;
  }

  function applyRoomState(room) {
    currentRoom = room;

    headerRoomName.textContent = room.name;
    headerRoomName.title       = room.name;
    roomCodeText.textContent   = room.id;
    headerOnline.textContent   = `${room.participants.length}`;

    const me = room.participants.find(p => p.id === socket.id);
    const isSpec = me ? Boolean(me.isSpectator) : false;
    if (me) {
      headerMyName.textContent = me.name;
      if (optionsCurrentName) optionsCurrentName.textContent = me.name;
      isMaster = me.isMaster;
    }

    if (headerSpectatorBtn) {
      if (isMaster) {
        headerSpectatorBtn.classList.add('hidden');
        if (optionsRowSpectator) optionsRowSpectator.classList.add('hidden');
      } else {
        headerSpectatorBtn.classList.remove('hidden');
        if (optionsRowSpectator) optionsRowSpectator.classList.remove('hidden');
        if (headerSpectatorIcon) headerSpectatorIcon.textContent = isSpec ? '👁️' : '🃏';
        if (headerSpectatorText) headerSpectatorText.textContent = isSpec ? t('role-spectator') : t('role-voter');
        if (optionsCurrentRole) optionsCurrentRole.textContent = isSpec ? (t('role-spectator') || 'Toeschouwer') : (t('role-voter') || 'Stemmer');
        const roleLabel = isSpec ? t('role-spectator') : t('role-voter');
        if (roleLabel) {
          headerSpectatorBtn.title = roleLabel;
          headerSpectatorBtn.setAttribute('aria-label', roleLabel);
        }
      }
    }

    if (isMaster) {
      showSMControls();
      smCurrentDeck.textContent = getDeckLabel(room.deckType);
      deckModalType.value       = room.deckType;
      if (smAutoRevealChk) smAutoRevealChk.checked = Boolean(room.autoReveal);
    } else {
      hideSMControls();
    }

    const storyText = (room.storyTitle || '').trim();
    if (storyTitleDisplay) {
      if (storyText) {
        storyTitleDisplay.textContent = storyText;
        storyTitleDisplay.classList.add('has-title');
      } else {
        storyTitleDisplay.textContent = t('story-empty');
        storyTitleDisplay.classList.remove('has-title');
      }
    }
    if (storyTitleInput && document.activeElement !== storyTitleInput) {
      storyTitleInput.value = storyText;
    }

    renderParticipants(participantsList, room, isMaster, socket);

    const votingCtx = {
      votingPhase, resultsPhase, votingPhaseTitle, votingPhaseSub,
      voteStatusBar, voteStatusText, cardDeck, presenterBanner, deckWrapper,
      socket, currentRoom,
      onVote: (val) => {
        myVote = val;
        selectVoteCard(cardDeck, val);
        if (val != null) {
          voteStatusBar.className    = 'vote-status-bar voted-state';
          voteStatusText.textContent = t('vote-status-picked', { card: `"${val}"` });
        } else {
          voteStatusBar.className    = 'vote-status-bar';
          voteStatusText.textContent = t('vote-status-text-init');
        }
      },
    };

    if (room.revealed) {
      renderResults({ votingPhase, resultsPhase, resultsSubtitle, resultsCardsGrid, resultsStats }, room);

      if (!hasCelebratedThisReveal) {
        const eligible = room.participants.filter(p => !p.isMaster && !p.isSpectator);
        const stats    = computeVoteStats(room.participants);
        if (isUnanimousConsensus(stats.votes, eligible.length) && getConfettiEnabled()) {
          celebrateConsensus();
        }
        hasCelebratedThisReveal = true; // only ever attempt once per reveal, win or lose
      }
    } else {
      hasCelebratedThisReveal = false;

      // Sync myVote from server state
      const me2 = room.participants.find(p => p.id === socket.id);
      const isSpec2 = me2 ? Boolean(me2.isSpectator) : false;
      if (me2 && me2.vote != null) myVote = me2.vote;
      else if (!me2 || !me2.hasVoted) myVote = null;

      renderVoting(votingCtx, room, isMaster, myVote, isSpec2);
    }

    // SM progress bar
    if (isMaster) {
      const voters = room.participants.filter(p => !p.isMaster && !p.isSpectator);
      const voted  = voters.filter(p => p.hasVoted).length;
      const total  = voters.length;
      const pct    = total > 0 ? Math.round((voted / total) * 100) : 0;
      smProgressFill.style.width = `${pct}%`;
      smProgressText.textContent = t('progress-text', { voted, total });
      if (room.revealed || (voted === 0 && !room.revealed)) isRevealing = false;
      smRevealBtn.disabled       = room.revealed || isRevealing || voted === 0;
      mobileRevealBtn.disabled   = smRevealBtn.disabled;
    }
  }

  // ── Socket events ─────────────────────────────────────────────────────────
  socket.on('room-joined', ({ room, isMaster: isM, sessionToken }) => {
    isMaster = isM;
    setSessionToken(urlRoomId, sessionToken);
    joinModal.classList.add('hidden');
    roomUi.classList.remove('hidden');
    applyRoomState(room); // loads the QR once, via showSMControls, if isM
    window._isInScrumRoom = true;
    window._scrumSocket   = socket;
    window._scrumRoomId   = urlRoomId;
    requestWakeLock();
  });

  socket.on('room-state',   ({ room }) => applyRoomState(room));

  socket.on('became-master', () => {
    isMaster = true;
    toast(t('toast-sm-promoted'), 'info');
    if (currentRoom) {
      currentRoom.masterId = socket.id;
      currentRoom.participants.forEach(p => { p.isMaster = (p.id === socket.id); });
      applyRoomState(currentRoom); // loads the QR once, via showSMControls
    }
  });

  socket.on('kicked', () => {
    window._isInScrumRoom = false;
    currentRoom = null;
    toast(t('toast-kicked'), 'error');
    setTimeout(() => { window.location.href = '/'; }, 2000);
  });

  socket.on('error',      ({ message }) => toast(message, 'error'));
  socket.on('disconnect', ()   => toast(t('toast-disconnect'), 'error'));
  socket.io.on('reconnect', () => toast(t('toast-reconnected'), 'success'));

  // Single re-join point. `connect` fires for every established connection —
  // socket.io's own reconnect as well as a manual `.connect()` from the
  // visibilitychange handler — where the manager-level `reconnect` event
  // covers only the former. Gated on `_isInScrumRoom`, which is set once the
  // first join succeeded, so the initial connection still goes through the
  // normal join flow instead of auto-joining behind the modal.
  socket.on('connect', () => {
    if (!urlRoomId || !window._isInScrumRoom) return;
    const savedSpec = localStorage.getItem('scrum_is_spectator') === 'true';
    socket.emit('join-room', {
      roomId:       urlRoomId,
      name:         getSavedName() || 'Anoniem',
      isSpectator:  savedSpec,
      sessionToken: getSessionToken(urlRoomId),
    });
  });

  // ── App version (shown in the options modal) ────────────────────────────────
  let appVersion = null;
  function renderVersion() {
    if (optionsVersion && appVersion) {
      optionsVersion.textContent = `${t('options-version-label')} ${appVersion}`;
    }
  }
  if (optionsVersion) {
    fetch('/api/config')
      .then(r => r.json())
      .then(data => {
        if (data.version) { appVersion = data.version; renderVersion(); }
      })
      .catch(() => {});
  }

  // ── Confetti toggle ("no fun mode") ─────────────────────────────────────────
  function renderConfettiToggle() {
    if (!confettiLabel) return;
    const enabled = getConfettiEnabled();
    confettiLabel.textContent = enabled ? t('confetti-on') : t('confetti-off');
    if (confettiToggle) confettiToggle.setAttribute('aria-pressed', String(enabled));
  }
  renderConfettiToggle();
  if (confettiToggle) {
    confettiToggle.addEventListener('click', () => {
      setConfettiEnabled(!getConfettiEnabled());
      renderConfettiToggle();
    });
  }

  // ── Australia mode ("everything upside down") ───────────────────────────────
  function renderAustraliaToggle() {
    if (!australiaLabel) return;
    const enabled = getAustraliaModeEnabled();
    australiaLabel.textContent = enabled ? t('confetti-on') : t('confetti-off');
    if (australiaToggle) australiaToggle.setAttribute('aria-pressed', String(enabled));
  }
  renderAustraliaToggle();
  if (australiaToggle) {
    australiaToggle.addEventListener('click', () => {
      const enabled = !getAustraliaModeEnabled();
      setAustraliaModeEnabled(enabled);
      applyAustraliaMode(enabled);
      renderAustraliaToggle();
    });
  }

  // ── Join flow ─────────────────────────────────────────────────────────────
  fetch(`/api/rooms/${urlRoomId}`)
    .then(r => r.json())
    .then(data => {
      if (data.exists) {
        joinModalRoom.textContent = `📍 ${data.name || urlRoomId}`;
      } else {
        localStorage.removeItem('scrum_auto_join_room');
        toast(t('toast-room-not-found', { id: urlRoomId }), 'error');
        setTimeout(() => { window.location.href = '/'; }, 2500);
        return;
      }
      const savedSpec = localStorage.getItem('scrum_is_spectator') === 'true';
      if (modalSpectatorChk) modalSpectatorChk.checked = savedSpec;
      const saved = getSavedName();
      if (saved) {
        modalNameInput.value = saved;
      }
      if (saved && localStorage.getItem('scrum_auto_join_room') === urlRoomId) {
        localStorage.removeItem('scrum_auto_join_room');
        doJoinRoom(saved, false);
        return;
      }
      modalNameInput.focus();
    })
    .catch(() => {
      const saved = getSavedName();
      if (saved) {
        modalNameInput.value = saved;
      }
      if (saved && localStorage.getItem('scrum_auto_join_room') === urlRoomId) {
        localStorage.removeItem('scrum_auto_join_room');
        doJoinRoom(saved, false);
      }
    });

  function doJoinRoom(name, isSpectator) {
    name = (name || modalNameInput.value).trim();
    if (!name) { toast(t('toast-enter-name'), 'error'); modalNameInput.focus(); return; }
    saveName(name);
    if (isSpectator === undefined && modalSpectatorChk) {
      isSpectator = modalSpectatorChk.checked;
    }
    localStorage.setItem('scrum_is_spectator', isSpectator ? 'true' : 'false');
    window._scrumSocket = socket;
    window._scrumRoomId = urlRoomId;
    socket.emit('join-room', {
      roomId:       urlRoomId,
      name,
      isSpectator:  Boolean(isSpectator),
      sessionToken: getSessionToken(urlRoomId),
    });
  }

  function toggleSpectator(targetSpec) {
    if (!currentRoom) return;
    const me = currentRoom.participants.find(p => p.id === socket.id);
    const newSpec = targetSpec !== undefined ? targetSpec : !(me && me.isSpectator);
    localStorage.setItem('scrum_is_spectator', newSpec ? 'true' : 'false');
    socket.emit('toggle-spectator', { roomId: currentRoom.id, isSpectator: newSpec });
    toast(newSpec ? t('toast-spectator-on') : t('toast-spectator-off'), 'info');
  }

  if (headerSpectatorBtn) {
    headerSpectatorBtn.addEventListener('click', () => toggleSpectator());
  }
  if (btnSwitchToVoter) {
    btnSwitchToVoter.addEventListener('click', () => toggleSpectator(false));
  }
  if (headerLeaveBtn) {
    headerLeaveBtn.addEventListener('click', () => {
      if (confirm(t('confirm-leave-room') || 'Weet je zeker dat je deze room wilt verlaten?')) {
        socket.disconnect();
        window.location.href = '/';
      }
    });
  }
  if (btnClaimSm) {
    btnClaimSm.addEventListener('click', () => {
      if (!currentRoom) return;
      if (confirm(t('confirm-claim-sm') || 'Wil je de rol van Scrum Master overnemen?')) {
        if (optionsModal) optionsModal.classList.add('hidden');
        socket.emit('claim-master', { roomId: currentRoom.id });
      }
    });
  }

  modalJoinBtn.addEventListener('click', () => doJoinRoom());
  if (modalNameInput) {
    modalNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doJoinRoom();
    });
  }

  window.addEventListener('lang-changed', () => {
    if (currentRoom) applyRoomState(currentRoom);
    renderVersion();
    renderConfettiToggle();
    renderAustraliaToggle();
  });
}
