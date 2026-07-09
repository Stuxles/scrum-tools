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
    btn.setAttribute('aria-label',   `Stem ${val}`);
    btn.setAttribute('role',         'radio');
    btn.setAttribute('aria-checked', String(myVote === val));
    btn.innerHTML = `<span>${val}</span>`;

    if (revealed) {
      btn.classList.add('disabled');
      btn.disabled = true;
    } else if (myVote === val) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', () => {
      if (revealed || !currentRoom) return;
      socket.emit('vote', { roomId: currentRoom.id, vote: val });
      onVote(val);
    });

    cardDeck.appendChild(btn);
  }
}

/**
 * Renders the voting phase view.
 *
 * @param {object}  ctx
 * @param {object}  room
 * @param {boolean} isMaster
 * @param {string|null} myVote
 */
export function renderVoting(ctx, room, isMaster, myVote) {
  const {
    votingPhase, resultsPhase, votingPhaseTitle, votingPhaseSub,
    voteStatusBar, voteStatusText, cardDeck, presenterBanner, deckWrapper,
    socket, currentRoom, onVote,
  } = ctx;

  votingPhase.classList.remove('hidden');
  resultsPhase.classList.add('hidden');

  if (isMaster) {
    presenterBanner?.classList.remove('hidden');
    deckWrapper?.classList.add('hidden');
    voteStatusBar.classList.add('hidden');
    votingPhaseTitle.textContent = 'Wachten op stemmen...';
    votingPhaseSub.textContent   = '';
  } else {
    presenterBanner?.classList.add('hidden');
    deckWrapper?.classList.remove('hidden');
    voteStatusBar.classList.remove('hidden');

    if (myVote) {
      voteStatusBar.className    = 'vote-status-bar voted-state';
      voteStatusText.textContent = `Je hebt "${myVote}" gekozen ✓`;
    } else {
      voteStatusBar.className    = 'vote-status-bar';
      voteStatusText.textContent = 'Nog niet gestemd';
    }
    votingPhaseTitle.textContent = 'Kies je schatting';
    votingPhaseSub.textContent   = 'Selecteer een kaart. Je stem is pas zichtbaar na de reveal.';

    renderCardDeck(cardDeck, room.deck, myVote, room.revealed, socket, currentRoom, onVote);
  }
}
