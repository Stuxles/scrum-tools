/**
 * Easter egg: the card deck as a slot machine. Every card rattles through
 * random labels for a moment and the machine then names one of them.
 *
 * It deliberately does not vote -- it emits nothing and never touches
 * `myVote`. The deck is only borrowed as a display: the real labels go back on
 * when the spin ends, and taps are blocked while it runs (`.is-spinning` in
 * the CSS), so a card cannot be clicked while it shows someone else's number.
 */

const TICK_MS = 70;
const SPIN_MS = 1400;
const JACKPOT_MS = 1400;

/**
 * A `room-state` landing mid-spin is safe without any bookkeeping here:
 * renderCardDeck either rebuilds the deck -- detaching the nodes this holds,
 * so the restore writes into nothing -- or leaves the labels alone entirely.
 *
 * @param {HTMLElement} cardDeck
 * @param {string[]}    deck     The room's current card values.
 * @param {(card: string) => void} onLand Called with the winning card.
 */
export function spinDeck(cardDeck, deck, onLand) {
  if (!cardDeck || !deck?.length) return;
  if (cardDeck.classList.contains('is-spinning')) return; // one spin at a time

  const cards = [...cardDeck.querySelectorAll('.vote-card')];
  if (cards.length === 0) return;

  const landed = deck[Math.floor(Math.random() * deck.length)];

  // No reduced-motion variant of a flicker: skip straight to the punchline.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    onLand(landed);
    return;
  }

  const labels   = cards.map(c => c.firstElementChild).filter(Boolean);
  const original = labels.map(l => l.textContent);

  cardDeck.classList.add('is-spinning');
  const ticker = setInterval(() => {
    for (const label of labels) {
      label.textContent = deck[Math.floor(Math.random() * deck.length)];
    }
  }, TICK_MS);

  setTimeout(() => {
    clearInterval(ticker);
    labels.forEach((label, i) => { label.textContent = original[i]; });
    cardDeck.classList.remove('is-spinning');

    const winner = cards.find(c => c.dataset.val === landed);
    if (winner) {
      winner.classList.add('is-jackpot');
      setTimeout(() => winner.classList.remove('is-jackpot'), JACKPOT_MS);
    }
    onLand(landed);
  }, SPIN_MS);
}
