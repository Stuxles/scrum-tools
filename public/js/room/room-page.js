/**
 * Room page coordinator.
 * Boots up all sub-modules, wires socket events, and owns the shared state.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} urlRoomId
 */

import { toast }                    from '../utils/toast.js';
import { getSavedName, saveName, copyToClipboard, requestWakeLock, releaseWakeLock } from '../utils/helpers.js';
import { onThemeChange }            from '../theme.js';
import { t }                        from '../utils/i18n.js';
import { renderVoting, selectVoteCard } from './render-voting.js';
import { renderResults }            from './render-results.js';
import { renderParticipants }       from './render-users.js';
import { initQrModule }             from './qr-module.js';

export function initRoomPage(socket, urlRoomId) {
  if (!urlRoomId) {
    window.location.replace('/');
    return;
  }

  // ── Shared state ──────────────────────────────────────────────────────────
  let isMaster    = false;
  let myVote      = null;
  let currentRoom = null;

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
  function showSMControls() {
    smPanel.classList.remove('hidden');
    mobileSMBar.classList.remove('hidden');
    headerQrBtn.classList.add('hidden');
    headerDeckBtn.classList.add('hidden');
    if (storyBannerEditor) storyBannerEditor.classList.remove('hidden');
    if (storyTitleDisplay) storyTitleDisplay.classList.add('hidden');
    document.body.classList.add('is-presenter');
  }
  function hideSMControls() {
    smPanel.classList.add('hidden');
    mobileSMBar.classList.add('hidden');
    headerQrBtn.classList.remove('hidden');
    headerDeckBtn.classList.add('hidden');
    if (storyBannerEditor) storyBannerEditor.classList.add('hidden');
    if (storyTitleDisplay) storyTitleDisplay.classList.remove('hidden');
    document.body.classList.remove('is-presenter');
  }

  function saveStoryTitle() {
    if (!currentRoom) return;
    const storyTitle = storyTitleInput?.value.trim() || '';
    socket.emit('update-story-title', { roomId: currentRoom.id, storyTitle });
    toast(storyTitle ? 'Ticket / story opgeslagen ✓' : 'Ticket gewist ✓', 'success');
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
      toast('Ticket gewist ✓', 'info');
    });
  }

  smRevealBtn.addEventListener('click', () => {
    if (!currentRoom || currentRoom.revealed) return;
    smRevealBtn.disabled     = true;
    mobileRevealBtn.disabled = true;
    socket.emit('reveal', { roomId: currentRoom.id });
  });
  mobileRevealBtn.addEventListener('click', () => smRevealBtn.click());

  smResetBtn.addEventListener('click', () => {
    if (!currentRoom) return;
    myVote = null;
    socket.emit('reset', { roomId: currentRoom.id });
    toast('Nieuwe ronde gestart 🔄', 'success');
  });
  mobileResetBtn.addEventListener('click', () => smResetBtn.click());

  // ── Room code copy ────────────────────────────────────────────────────────
  headerRoomCode.addEventListener('click', () => {
    copyToClipboard(
      urlRoomId,
      () => toast(`Code "${urlRoomId}" gekopieerd!`, 'success'),
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
      if (customCards.length < 2) { toast('Voer minimaal 2 kaarten in', 'error'); return; }
    }
    socket.emit('change-deck', { roomId: currentRoom.id, deckType, customCards });
    deckModal.classList.add('hidden');
    myVote = null;
  });

  // ── Name modal ────────────────────────────────────────────────────────────
  headerNameBtn.addEventListener('click', () => {
    nameModalInput.value = getSavedName();
    nameModal.classList.remove('hidden');
    nameModalInput.focus();
    nameModalInput.select();
  });

  function saveNameChange() {
    const name = nameModalInput.value.trim();
    if (!name) { toast('Naam mag niet leeg zijn', 'error'); return; }
    saveName(name);
    if (currentRoom) socket.emit('update-name', { roomId: currentRoom.id, name });
    nameModal.classList.add('hidden');
    toast('Naam bijgewerkt ✓', 'success');
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
      isMaster = me.isMaster;
    }

    if (headerSpectatorBtn) {
      if (isMaster) {
        headerSpectatorBtn.classList.add('hidden');
      } else {
        headerSpectatorBtn.classList.remove('hidden');
        if (headerSpectatorIcon) headerSpectatorIcon.textContent = isSpec ? '👁️' : '🃏';
        if (headerSpectatorText) headerSpectatorText.textContent = isSpec ? t('role-spectator') : t('role-voter');
      }
    }

    if (isMaster) {
      showSMControls();
      smCurrentDeck.textContent = getDeckLabel(room.deckType);
      deckModalType.value       = room.deckType;
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
    } else {
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
      smRevealBtn.disabled       = room.revealed || voted === 0;
      mobileRevealBtn.disabled   = smRevealBtn.disabled;
    }
  }

  // ── Socket events ─────────────────────────────────────────────────────────
  socket.on('room-joined', ({ room, isMaster: isM }) => {
    isMaster = isM;
    joinModal.classList.add('hidden');
    roomUi.classList.remove('hidden');
    applyRoomState(room);
    if (isM) qr.loadQR();
    window._isInScrumRoom = true;
    window._scrumSocket   = socket;
    window._scrumRoomId   = urlRoomId;
    requestWakeLock();
  });

  socket.on('room-state',   ({ room }) => applyRoomState(room));

  socket.on('became-master', () => {
    isMaster = true;
    toast('Je bent nu de Scrum Master 👑', 'info');
    if (currentRoom) {
      currentRoom.masterId = socket.id;
      currentRoom.participants.forEach(p => { p.isMaster = (p.id === socket.id); });
      applyRoomState(currentRoom);
      qr.loadQR();
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
  socket.io.on('reconnect', () => {
    toast(t('toast-reconnected'), 'success');
    if (urlRoomId && window._isInScrumRoom) {
      const savedSpec = localStorage.getItem('scrum_is_spectator') === 'true';
      socket.emit('join-room', { roomId: urlRoomId, name: getSavedName() || 'Anoniem', isSpectator: savedSpec });
    }
  });

  // ── Join flow ─────────────────────────────────────────────────────────────
  fetch(`/api/rooms/${urlRoomId}`)
    .then(r => r.json())
    .then(data => {
      if (data.exists) {
        joinModalRoom.textContent = `📍 ${data.name || urlRoomId}`;
      } else {
        toast(`Room "${urlRoomId}" bestaat niet.`, 'error');
        setTimeout(() => { window.location.href = '/'; }, 2500);
        return;
      }
      const savedSpec = localStorage.getItem('scrum_is_spectator') === 'true';
      if (modalSpectatorChk) modalSpectatorChk.checked = savedSpec;
      const saved = getSavedName();
      if (saved) {
        modalNameInput.value = saved;
        doJoinRoom(saved, savedSpec);
      } else {
        modalNameInput.focus();
      }
    })
    .catch(() => {
      const saved = getSavedName();
      if (saved) modalNameInput.value = saved;
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
    socket.emit('join-room', { roomId: urlRoomId, name, isSpectator: Boolean(isSpectator) });
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

  modalJoinBtn.addEventListener('click',    () => doJoinRoom());
  modalNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoinRoom(); });

  window.addEventListener('lang-changed', () => {
    if (currentRoom) applyRoomState(currentRoom);
  });
}
