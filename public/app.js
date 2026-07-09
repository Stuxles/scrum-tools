/**
 * Scrum Poker Collab — Client Logic
 * Handles both index.html and room.html
 */
'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────
const LS_NAME    = 'scrumpoker_name';
const socket     = io({ transports: ['websocket', 'polling'] });
const isRoomPage = window.location.pathname.includes('room.html');
const urlParams  = new URLSearchParams(window.location.search);
const urlRoomId  = (urlParams.get('id') || '').toUpperCase();

// ── Toast System ───────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── localStorage helpers ───────────────────────────────────────────────────────
function getSavedName() { return localStorage.getItem(LS_NAME) || ''; }
function saveName(n)    { if (n) localStorage.setItem(LS_NAME, n); }

// ════════════════════════════════════════════════════════════════════════════════
//  INDEX PAGE
// ════════════════════════════════════════════════════════════════════════════════
function initIndexPage() {
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

  // Pre-fill name
  const saved = getSavedName();
  if (saved) { createName.value = saved; joinName.value = saved; }

  // Tab switching
  function switchTab(tab) {
    const isCreate = (tab === 'create');
    createTab.classList.toggle('active', isCreate);
    joinTab.classList.toggle('active', !isCreate);
    createTab.setAttribute('aria-selected', String(isCreate));
    joinTab.setAttribute('aria-selected', String(!isCreate));
    createPanel.classList.toggle('hidden', !isCreate);
    joinPanel.classList.toggle('hidden', isCreate);
  }
  createTab.addEventListener('click', () => switchTab('create'));
  joinTab.addEventListener('click',   () => switchTab('join'));

  // If URL has room id → pre-fill join tab
  if (urlRoomId) {
    if (joinCodeInput) joinCodeInput.value = urlRoomId;
    switchTab('join');
    joinName.focus();
  }

  // Custom deck toggle
  deckTypeSelect.addEventListener('change', () => {
    customField.classList.toggle('hidden', deckTypeSelect.value !== 'custom');
  });

  // Create room
  createBtn.addEventListener('click', () => {
    const name     = createName.value.trim();
    const deckType = deckTypeSelect.value;
    const roomName = roomNameInput.value.trim();

    if (!name) { toast('Voer je naam in', 'error'); createName.focus(); return; }

    let custom = [];
    if (deckType === 'custom') {
      custom = customCards.value.split(',').map(s => s.trim()).filter(Boolean);
      if (custom.length < 2) {
        toast('Voer minimaal 2 kaarten in (komma-gescheiden)', 'error');
        customCards.focus();
        return;
      }
    }

    saveName(name);
    createBtn.disabled = true;
    createBtn.textContent = 'Aanmaken…';
    socket.emit('create-room', { name, deckType, customCards: custom, roomName });
  });

  // Join room
  function doJoin() {
    const name = joinName.value.trim();
    const code = joinCodeInput.value.trim().toUpperCase();

    if (!name) { toast('Voer je naam in', 'error'); joinName.focus(); return; }
    if (!code) { toast('Voer een room code in', 'error'); joinCodeInput.focus(); return; }

    saveName(name);
    joinBtn.disabled = true;
    joinBtn.textContent = 'Verbinden…';
    socket.emit('join-room', { roomId: code, name });
  }

  joinBtn.addEventListener('click', doJoin);
  joinCodeInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
  joinName.addEventListener('keydown',     e => { if (e.key === 'Enter') doJoin(); });

  // Always uppercase room code
  joinCodeInput.addEventListener('input', () => {
    joinCodeInput.value = joinCodeInput.value.toUpperCase();
  });

  // Socket events (index page)
  socket.on('room-created', ({ roomId }) => {
    window.location.href = `/room.html?id=${roomId}`;
  });

  socket.on('room-joined', ({ room }) => {
    window.location.href = `/room.html?id=${room.id}`;
  });

  socket.on('error', ({ message }) => {
    toast(message, 'error');
    createBtn.disabled = false;
    createBtn.textContent = '✦ Maak Room aan';
    joinBtn.disabled = false;
    joinBtn.textContent = '→ Meedoen';
  });
}

// ════════════════════════════════════════════════════════════════════════════════
//  ROOM PAGE
// ════════════════════════════════════════════════════════════════════════════════

// State
let myId        = null;
let isMaster    = false;
let myVote      = null;
let currentRoom = null;
let qrUrl       = null;

function initRoomPage() {
  if (!urlRoomId) {
    toast('Geen room-ID gevonden in de URL.', 'error');
    setTimeout(() => { window.location.href = '/'; }, 2000);
    return;
  }

  // ── Elements ───────────────────────────────────────────────────────────────
  const joinModal        = document.getElementById('join-modal');
  const joinModalRoom    = document.getElementById('join-modal-room');
  const modalNameInput   = document.getElementById('modal-name');
  const modalJoinBtn     = document.getElementById('modal-join-btn');
  const roomUi           = document.getElementById('room-ui');

  const headerRoomName   = document.getElementById('header-room-name');
  const headerRoomCode   = document.getElementById('header-room-code');
  const roomCodeText     = document.getElementById('room-code-text');
  const headerOnline     = document.getElementById('header-online-count');
  const headerQrBtn      = document.getElementById('header-qr-btn');
  const headerDeckBtn    = document.getElementById('header-deck-btn');
  const headerNameBtn    = document.getElementById('header-name-btn');
  const headerMyName     = document.getElementById('header-my-name');

  const participantsList = document.getElementById('participants-list');
  const cardDeck         = document.getElementById('card-deck');

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

  // ── Join flow ──────────────────────────────────────────────────────────────
  // First, check if room exists
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

      const saved = getSavedName();
      if (saved) {
        modalNameInput.value = saved;
        // Auto-join if name already known
        doJoinRoom(saved);
      } else {
        modalNameInput.focus();
      }
    })
    .catch(() => {
      // Server might not be reachable yet, just show modal
      const saved = getSavedName();
      if (saved) modalNameInput.value = saved;
    });

  function doJoinRoom(name) {
    name = (name || modalNameInput.value).trim();
    if (!name) { toast('Voer je naam in', 'error'); modalNameInput.focus(); return; }
    saveName(name);
    socket.emit('join-room', { roomId: urlRoomId, name });
  }

  modalJoinBtn.addEventListener('click', () => doJoinRoom());
  modalNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoinRoom(); });

  // ── Socket events ──────────────────────────────────────────────────────────
  socket.on('room-joined', ({ room, isMaster: isM }) => {
    myId     = socket.id;
    isMaster = isM;
    joinModal.classList.add('hidden');
    roomUi.classList.remove('hidden');
    applyRoomState(room);
    if (isM) loadQR();
  });

  socket.on('room-state', ({ room }) => {
    applyRoomState(room);
  });

  socket.on('became-master', () => {
    isMaster = true;
    toast('Je bent nu de Scrum Master 👑', 'info');
    if (currentRoom) {
      showSMControls();
      loadQR();
    }
  });

  socket.on('kicked', () => {
    toast('Je bent uit de room verwijderd.', 'error');
    setTimeout(() => { window.location.href = '/'; }, 2000);
  });

  socket.on('error', ({ message }) => {
    toast(message, 'error');
  });

  socket.on('disconnect', () => {
    toast('Verbinding verbroken — opnieuw verbinden…', 'error');
  });

  socket.on('reconnect', () => {
    toast('Opnieuw verbonden!', 'success');
    if (currentRoom) {
      const name = getSavedName() || 'Anoniem';
      socket.emit('join-room', { roomId: urlRoomId, name });
    }
  });

  // ── Apply room state ───────────────────────────────────────────────────────
  function applyRoomState(room) {
    currentRoom = room;

    // Header
    headerRoomName.textContent = room.name;
    headerRoomName.title       = room.name;
    roomCodeText.textContent   = room.id;
    headerOnline.textContent   = `${room.participants.length}`;

    const me = room.participants.find(p => p.id === socket.id);
    if (me) {
      headerMyName.textContent = me.name;
      isMaster = me.isMaster;
    }

    // SM visibility
    if (isMaster) showSMControls();

    // Deck info
    const deckLabels = {
      standard:  'Standaard (0–40)',
      fibonacci:  'Fibonacci',
      tshirt:    'T-Shirt',
      custom:    'Aangepast',
    };
    smCurrentDeck.textContent = deckLabels[room.deckType] || room.deckType;
    deckModalType.value = room.deckType;

    // Participants list
    renderParticipants(room);

    // Phase
    if (room.revealed) {
      renderResults(room);
    } else {
      renderVoting(room);
    }

    // SM progress — master zelf telt niet mee als stemmer (stemt via telefoon)
    if (isMaster) {
      const voters = room.participants.filter(p => !p.isMaster);
      const voted  = voters.filter(p => p.hasVoted).length;
      const total  = voters.length;
      const pct    = total > 0 ? Math.round((voted / total) * 100) : 0;
      smProgressFill.style.width = `${pct}%`;
      smProgressText.textContent = `${voted} / ${total} gestemd`;
      smRevealBtn.disabled   = (total === 0 || (voted === 0 && !room.revealed));
      mobileRevealBtn.disabled = smRevealBtn.disabled;
    }
  }

  // ── Participants ───────────────────────────────────────────────────────────
  function renderParticipants(room) {
    participantsList.innerHTML = '';

    for (const p of room.participants) {
      const li = document.createElement('li');
      li.className = 'participant-item';
      li.dataset.id = p.id;

      const initial = (p.name || '?')[0].toUpperCase();

      const statusEl = document.createElement('div');
      statusEl.className = 'participant-status';

      if (p.isMaster) {
        // SM is in presenter mode — geen stem-indicator tonen
        statusEl.className += ' presenter-mode';
        statusEl.textContent = '🖥️';
        statusEl.title = 'Presenter-scherm (stemt via telefoon)';
      } else if (room.revealed && p.hasVoted) {
        statusEl.className += ' revealed-vote';
        statusEl.textContent = p.vote || '—';
        statusEl.title = `Stem: ${p.vote}`;
      } else if (p.hasVoted) {
        statusEl.className += ' voted';
        statusEl.textContent = '✓';
        statusEl.title = 'Gestemd';
      } else {
        statusEl.className += ' not-voted';
        statusEl.textContent = '…';
        statusEl.title = 'Nog niet gestemd';
      }

      li.innerHTML = `
        <div class="participant-avatar" aria-hidden="true">${initial}</div>
        <div class="participant-info">
          <div class="participant-name">${escHtml(p.name)}${p.id === socket.id ? ' <span style="color:var(--purple-300)">(jij)</span>' : ''}${p.isMaster ? ' 👑' : ''}</div>
          <div class="participant-role">${p.isMaster ? 'Scrum Master' : 'Deelnemer'}</div>
        </div>
      `;
      li.appendChild(statusEl);

      // Kick button (SM only, not self)
      if (isMaster && p.id !== socket.id) {
        const kickBtn = document.createElement('button');
        kickBtn.className = 'btn btn-danger btn-icon kick-btn';
        kickBtn.textContent = '✕';
        kickBtn.title = `${p.name} verwijderen`;
        kickBtn.setAttribute('aria-label', `${p.name} verwijderen`);
        kickBtn.addEventListener('click', () => {
          socket.emit('kick-user', { roomId: currentRoom.id, targetId: p.id });
        });
        li.appendChild(kickBtn);
      }

      participantsList.appendChild(li);
    }
  }

  // ── Voting Phase ───────────────────────────────────────────────────────────
  // -- Voting Phase -----------------------------------------------------------
  function renderVoting(room) {
    votingPhase.classList.remove('hidden');
    resultsPhase.classList.add('hidden');

    const me = room.participants.find(p => p.id === socket.id);
    myVote = me ? me.vote : null;

    const presenterBanner = document.getElementById('presenter-banner');
    const deckWrapper     = document.getElementById('deck-wrapper');

    if (isMaster) {
      // SM presenter view: geen kaartendeck zichtbaar op het gedeelde scherm.
      // De SM stemt mee via zijn telefoon (als gewone deelnemer in dezelfde room).
      if (presenterBanner) presenterBanner.classList.remove('hidden');
      if (deckWrapper)     deckWrapper.classList.add('hidden');
      voteStatusBar.classList.add('hidden');
      votingPhaseTitle.textContent = 'Wachten op stemmen...';
      votingPhaseSub.textContent   = '';
    } else {
      // Gewone deelnemer: toon kaartendeck
      if (presenterBanner) presenterBanner.classList.add('hidden');
      if (deckWrapper)     deckWrapper.classList.remove('hidden');
      voteStatusBar.classList.remove('hidden');

      if (myVote) {
        voteStatusBar.className = 'vote-status-bar voted-state';
        voteStatusText.textContent = 'Je hebt "' + myVote + '" gekozen ✓';
      } else {
        voteStatusBar.className = 'vote-status-bar';
        voteStatusText.textContent = 'Nog niet gestemd';
      }
      votingPhaseTitle.textContent = 'Kies je schatting';
      votingPhaseSub.textContent   = 'Selecteer een kaart. Je stem is pas zichtbaar na de reveal.';

      buildCardDeck(room.deck, room.revealed);
    }
  }

  function buildCardDeck(deck, disabled) {
    cardDeck.innerHTML = '';
    for (const val of deck) {
      const btn = document.createElement('button');
      btn.className = 'vote-card';
      btn.dataset.val = val;
      btn.setAttribute('aria-label', `Stem ${val}`);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(myVote === val));
      btn.innerHTML = `<span>${val}</span>`;

      if (disabled) {
        btn.classList.add('disabled');
        btn.disabled = true;
      } else if (myVote === val) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => {
        if (disabled || !currentRoom) return;
        myVote = val;
        socket.emit('vote', { roomId: currentRoom.id, vote: val });

        // Instant feedback
        document.querySelectorAll('.vote-card').forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
        voteStatusBar.className = 'vote-status-bar voted-state';
        voteStatusText.textContent = `Je hebt "${val}" gekozen ✓`;
      });

      cardDeck.appendChild(btn);
    }
  }

  // ── Results Phase ──────────────────────────────────────────────────────────
  function renderResults(room) {
    votingPhase.classList.add('hidden');
    resultsPhase.classList.remove('hidden');

    // Sluit de SM (presenter) uit van de resultaten-telling
    const nonMaster = room.participants.filter(p => !p.isMaster);
    const voters    = nonMaster.filter(p => p.hasVoted);

    resultsSubtitle.textContent = `${voters.length} van ${nonMaster.length} deelnemers stemden`;

    // Cards grid
    resultsCardsGrid.innerHTML = '';
    for (const p of nonMaster) {
      const div = document.createElement('div');
      div.className = 'result-card';
      div.setAttribute('role', 'listitem');

      const face = document.createElement('div');
      face.className = p.hasVoted ? 'result-card-face' : 'result-card-face no-vote';
      face.textContent = p.hasVoted ? (p.vote || '—') : '—';

      const nameEl = document.createElement('div');
      nameEl.className = 'result-card-name';
      nameEl.textContent = p.name;
      nameEl.title = p.name;

      div.appendChild(face);
      div.appendChild(nameEl);
      resultsCardsGrid.appendChild(div);
    }

    // Statistics
    renderStats(room);
  }

  function renderStats(room) {
    // Sluit SM (presenter) uit van statistieken
    const votes    = room.participants.filter(p => !p.isMaster && p.hasVoted).map(p => p.vote);
    const numeric  = votes.map(v => parseFloat(v)).filter(v => !isNaN(v));
    const nonNum   = votes.filter(v => isNaN(parseFloat(v)));

    const avg      = numeric.length ? (numeric.reduce((a,b) => a+b, 0) / numeric.length) : null;
    const sorted   = [...numeric].sort((a,b) => a-b);
    const median   = sorted.length ? (sorted.length % 2 === 0
      ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
      : sorted[Math.floor(sorted.length/2)]) : null;

    // Distribution
    const dist = {};
    for (const v of votes) dist[v] = (dist[v] || 0) + 1;
    const maxCount = Math.max(...Object.values(dist));

    let statsHtml = '';

    if (avg !== null) {
      statsHtml += `
        <div class="stat-item">
          <div class="stat-value">${avg % 1 === 0 ? avg : avg.toFixed(1)}</div>
          <div class="stat-label">Gemiddelde</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <div class="stat-value">${median % 1 === 0 ? median : median.toFixed(1)}</div>
          <div class="stat-label">Mediaan</div>
        </div>
      `;
      if (nonNum.length > 0) {
        statsHtml += `<div class="stat-divider"></div>`;
      }
    }

    if (nonNum.length > 0) {
      const nonNumCounts = {};
      for (const v of nonNum) nonNumCounts[v] = (nonNumCounts[v] || 0) + 1;
      const nonNumDisplay = Object.entries(nonNumCounts).map(([v,c]) => `${v}×${c}`).join(' ');
      statsHtml += `
        <div class="stat-item">
          <div class="stat-value" style="font-size:1.2rem;">${nonNumDisplay}</div>
          <div class="stat-label">Overig</div>
        </div>
      `;
    }

    // Distribution bars
    if (Object.keys(dist).length > 0) {
      if (statsHtml) statsHtml += `<div class="stat-divider"></div>`;
      const bars = Object.entries(dist)
        .sort((a,b) => {
          const na = parseFloat(a[0]), nb = parseFloat(b[0]);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          if (!isNaN(na)) return -1;
          if (!isNaN(nb)) return  1;
          return 0;
        })
        .map(([v,c]) => {
          const pct = Math.round((c / maxCount) * 100);
          return `
            <div class="dist-row">
              <span class="dist-val">${v}</span>
              <div class="dist-bar-track">
                <div class="dist-bar-fill" style="width:${pct}%"></div>
              </div>
              <span class="dist-count">${c}×</span>
            </div>
          `;
        }).join('');

      statsHtml += `
        <div class="vote-distribution">
          <div class="vote-distribution-label">Verdeling</div>
          <div class="dist-bars">${bars}</div>
        </div>
      `;
    }

    resultsStats.innerHTML = statsHtml;
  }

  // ── SM Controls ────────────────────────────────────────────────────────────
  function showSMControls() {
    smPanel.classList.remove('hidden');
    headerDeckBtn.classList.remove('hidden');
    mobileSMBar.classList.remove('hidden');
    document.body.classList.add('is-presenter');
  }

  // Reveal
  smRevealBtn.addEventListener('click', () => {
    if (!currentRoom) return;
    socket.emit('reveal', { roomId: currentRoom.id });
  });
  mobileRevealBtn.addEventListener('click', () => smRevealBtn.click());

  // Reset
  smResetBtn.addEventListener('click', () => {
    if (!currentRoom) return;
    myVote = null;
    socket.emit('reset', { roomId: currentRoom.id });
  });
  mobileResetBtn.addEventListener('click', () => smResetBtn.click());

  // QR / link buttons
  function openQrModal() {
    if (!qrUrl) { toast('QR code nog niet geladen…', 'info'); return; }
    qrModalImg.src = smQrImg.src;
    qrModalUrl.textContent = qrUrl;
    qrModal.classList.remove('hidden');
  }

  headerQrBtn.addEventListener('click', openQrModal);
  mobileQrBtn.addEventListener('click', openQrModal);
  qrCloseBtn.addEventListener('click',  () => qrModal.classList.add('hidden'));
  qrModal.addEventListener('click', e => { if (e.target === qrModal) qrModal.classList.add('hidden'); });

  async function copyLink() {
    if (!qrUrl) { toast('Link nog niet beschikbaar', 'error'); return; }
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast('Link gekopieerd! 📋', 'success');
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = qrUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Link gekopieerd! 📋', 'success');
    }
  }

  smCopyLinkBtn.addEventListener('click', copyLink);
  qrCopyBtn.addEventListener('click',    copyLink);

  // Room code copy
  headerRoomCode.addEventListener('click', async () => {
    const code = urlRoomId;
    try { await navigator.clipboard.writeText(code); } catch { /**/ }
    toast(`Code "${code}" gekopieerd!`, 'success');
  });

  // ── Deck change modal ──────────────────────────────────────────────────────
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

  deckModalType.addEventListener('change', () => {
    deckCustomField.classList.toggle('hidden', deckModalType.value !== 'custom');
  });

  deckModalSave.addEventListener('click', () => {
    const deckType = deckModalType.value;
    let customCards = [];
    if (deckType === 'custom') {
      customCards = deckModalCustom.value.split(',').map(s => s.trim()).filter(Boolean);
      if (customCards.length < 2) {
        toast('Voer minimaal 2 kaarten in', 'error');
        return;
      }
    }
    socket.emit('change-deck', { roomId: currentRoom.id, deckType, customCards });
    deckModal.classList.add('hidden');
    myVote = null;
  });

  // ── Name edit modal ────────────────────────────────────────────────────────
  headerNameBtn.addEventListener('click', () => {
    nameModalInput.value = getSavedName();
    nameModal.classList.remove('hidden');
    nameModalInput.focus();
    nameModalInput.select();
  });

  function savNameChange() {
    const name = nameModalInput.value.trim();
    if (!name) { toast('Naam mag niet leeg zijn', 'error'); return; }
    saveName(name);
    if (currentRoom) socket.emit('update-name', { roomId: currentRoom.id, name });
    nameModal.classList.add('hidden');
    toast('Naam bijgewerkt ✓', 'success');
  }

  nameModalSave.addEventListener('click',  savNameChange);
  nameModalCancel.addEventListener('click', () => nameModal.classList.add('hidden'));
  nameModalInput.addEventListener('keydown', e => { if (e.key === 'Enter') savNameChange(); });
  nameModal.addEventListener('click', e => { if (e.target === nameModal) nameModal.classList.add('hidden'); });

  // ── Load QR ────────────────────────────────────────────────────────────────
  async function loadQR() {
    try {
      const res  = await fetch(`/api/rooms/${urlRoomId}/qr`);
      const data = await res.json();
      qrUrl = data.url;

      smQrImg.src = data.qr;
      smQrImg.classList.remove('hidden');
      smQrPlaceholder.classList.add('hidden');
      smQrUrl.textContent = data.url;
    } catch {
      smQrPlaceholder.textContent = 'QR niet beschikbaar';
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ───────────────────────────────────────────────────────────────────────
function initThemeToggle() {
  const btn  = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  if (!btn || !icon) return;

  function updateIcon(t) {
    icon.textContent = t === 'light' ? '🌙' : '☀️';
  }
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  updateIcon(current);

  btn.addEventListener('click', () => {
    const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('scrumpoker_theme', t);
    updateIcon(t);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  if (isRoomPage) {
    initRoomPage();
  } else {
    initIndexPage();
  }
});
