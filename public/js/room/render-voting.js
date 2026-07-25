import { t } from '../utils/i18n.js';

/**
 * Renders the voting card deck for participants.
 *
 * @param {HTMLElement}                      cardDeck
 * @param {string[]}                         deck
 * @param {string|null}                      myVote
 * @param {boolean}                          revealed
 * @param {import('socket.io-client').Socket} socket
 * @param {{ id: string }}                   currentRoom
 * @param {Function}                         onVote  Called with the chosen value.
 */
export function renderCardDeck(cardDeck, deck, myVote, revealed, socket, currentRoom, onVote) {
  cardDeck.innerHTML = '';

  for (const val of deck) {
    const btn = document.createElement('button');
    btn.className = 'vote-card';
    btn.dataset.val = val;
    btn.setAttribute('aria-label',   t('aria-vote-card', { val }) || `Stem ${val}`);
    btn.setAttribute('role',         'radio');
    btn.setAttribute('aria-checked', String(myVote === val));
    const span = document.createElement('span');
    span.textContent = val;
    btn.appendChild(span);

    if (revealed) {
      btn.classList.add('disabled');
      btn.disabled = true;
    } else if (myVote === val) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', () => {
      if (revealed || !currentRoom) return;
      const isAlreadySelected = btn.classList.contains('selected');
      const nextVal = isAlreadySelected ? null : val;
      socket.emit('vote', { roomId: currentRoom.id, vote: nextVal });
      onVote(nextVal);
    });

    cardDeck.appendChild(btn);
  }
}

/**
 * Selects a specific card inside the given card deck and deselects all others.
 * @param {HTMLElement} cardDeck
 * @param {string|null} val
 */
export function selectVoteCard(cardDeck, val) {
  if (!cardDeck) return;
  cardDeck.querySelectorAll('.vote-card').forEach(c => {
    const isChosen = val !== null && val !== undefined && c.dataset.val === String(val);
    c.classList.toggle('selected', isChosen);
    c.setAttribute('aria-checked', String(isChosen));
  });
}

/**
 * Renders the voting phase view.
 *
 * Takes no `isMaster`: holding the host role no longer changes what you see
 * here. Presenting moved to its own page, so a host is an ordinary voter and
 * only spectators sit a round out.
 *
 * @param {object}  ctx
 * @param {object}  room
 * @param {string|null} myVote
 * @param {boolean} [isSpectator]
 */
export function renderVoting(ctx, room, myVote, isSpectator = false) {
  const {
    votingPhase, resultsPhase, votingPhaseTitle, votingPhaseSub,
    voteStatusBar, voteStatusText, cardDeck, deckWrapper,
    socket, currentRoom, onVote,
  } = ctx;

  const spectatorBanner = document.getElementById('spectator-banner');
  votingPhase.classList.remove('hidden');
  resultsPhase.classList.add('hidden');

  if (isSpectator) {
    spectatorBanner?.classList.remove('hidden');
    deckWrapper?.classList.add('hidden');
    voteStatusBar.classList.add('hidden');
    votingPhaseTitle.textContent = t('spectator-banner-title');
    votingPhaseSub.textContent   = t('spectator-banner-sub');
  } else {
    spectatorBanner?.classList.add('hidden');
    deckWrapper?.classList.remove('hidden');
    voteStatusBar.classList.remove('hidden');

    if (myVote) {
      voteStatusBar.className    = 'vote-status-bar voted-state';
      voteStatusText.textContent = t('vote-status-picked', { card: `"${myVote}"` });
    } else {
      voteStatusBar.className    = 'vote-status-bar';
      voteStatusText.textContent = t('vote-status-text-init');
    }
    votingPhaseTitle.textContent = t('voting-phase-title');
    votingPhaseSub.textContent   = t('voting-phase-subtitle');

    renderCardDeck(cardDeck, room.deck, myVote, room.revealed, socket, currentRoom, onVote);
  }
}
