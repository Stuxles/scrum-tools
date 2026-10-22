import { escHtml } from '../utils/helpers.js';
import { t }       from '../utils/i18n.js';
import { computeVoteStats, eligibleVoters } from '../utils/stats.js';

/**
 * Results phase renderer — cards grid and statistics panel.
 *
 * Two things here exist because of the presenter screen.
 *
 * The cards are updated in place, keyed by participant id, instead of being
 * rebuilt. `room-state` arrives on every join, rename, reconnect and grace
 * expiry — all of which happen *while* a round sits revealed — and a rebuilt
 * `.result-card` restarts its `flipIn` animation from `opacity: 0`. On a wall
 * screen that read as the results blinking out and flipping back in, several
 * times a round, for events that changed nothing about the votes.
 *
 * Which is also why the flip is opt-in per render: it belongs to the reveal
 * itself. `resultsPhase` carries `hidden` for as long as the room is not
 * revealed (both callers set it on reset), so its state on entry is exactly
 * "is this the first render of this reveal" — no extra bookkeeping needed.
 *
 * @param {object} ctx  Elements: votingPhase, resultsPhase, resultsSubtitle,
 *                      resultsCardsGrid, resultsStats
 * @param {object} room
 */
export function renderResults(ctx, room) {
  const { votingPhase, resultsPhase, resultsSubtitle, resultsCardsGrid, resultsStats } = ctx;

  const isNewReveal = resultsPhase.classList.contains('hidden');

  votingPhase.classList.add('hidden');
  resultsPhase.classList.remove('hidden');

  // The same population the progress bar counted and the server revealed on,
  // so the subtitle can't contradict the bar it just replaced. Spectators and
  // people who went offline without voting are out; the host votes like
  // everyone else, and a presenter screen is not a participant to begin with.
  const eligible = eligibleVoters(room.participants);
  const voters   = eligible.filter(p => p.hasVoted);

  resultsSubtitle.textContent = t('progress-text', { voted: voters.length, total: eligible.length });

  // ── Cards grid ────────────────────────────────────────────────────────────
  // The stagger used to be ten hand-written `nth-child` rules, so an eleventh
  // voter's card flipped in with no delay at all. The index travels as a
  // custom property instead, which the CSS turns into a delay for any count.
  renderCards(resultsCardsGrid, eligible, isNewReveal);

  // ── Statistics ────────────────────────────────────────────────────────────
  renderStats(resultsStats, room);
}

/**
 * @param {HTMLElement}   grid
 * @param {Array<object>} eligible
 * @param {boolean}       animate
 */
function renderCards(grid, eligible, animate) {
  /** @type {Map<string, HTMLElement>} */
  const existing = new Map();
  for (const card of grid.children) existing.set(card.dataset.id, card);

  let previous = null;
  let index    = 0;

  for (const p of eligible) {
    let card = existing.get(p.id);
    if (!card) {
      card = document.createElement('div');
      card.className = 'result-card';
      card.setAttribute('role', 'listitem');

      const face = document.createElement('div');
      face.className = 'result-card-face';

      const nameEl = document.createElement('div');
      nameEl.className = 'result-card-name';

      card.append(face, nameEl);
    }
    existing.delete(p.id);

    card.dataset.id = p.id;
    card.style.setProperty('--card-index', String(index));

    const face = card.children[0];
    const want = p.hasVoted ? 'result-card-face' : 'result-card-face no-vote';
    if (face.className !== want) face.className = want;
    const faceText = p.hasVoted ? (p.vote || '—') : '—';
    if (face.textContent !== faceText) face.textContent = faceText;

    const nameEl = card.children[1];
    if (nameEl.textContent !== p.name) {
      nameEl.textContent = p.name;
      nameEl.title       = p.name;
    }

    const shouldFollow = previous ? previous.nextSibling : grid.firstChild;
    if (card !== shouldFollow) grid.insertBefore(card, shouldFollow);
    previous = card;
    index++;
  }

  for (const card of existing.values()) card.remove();

  // One class on the grid drives every card's flip. Because the cards now
  // survive between rounds, a second reveal has to re-trigger the animation
  // explicitly: drop the class, flush the style so the browser sees it gone,
  // then put it back. Left on afterwards, it is inert — a finished `backwards`
  // animation holds no state, and the keyframe's end matches the card's
  // resting style — and the one case it still catches is the right one: a
  // card that appears mid-reveal flips in like the others did.
  if (animate) {
    grid.classList.remove('is-flipping-in');
    void grid.offsetWidth;
    grid.classList.add('is-flipping-in');
  }
}

function renderStats(container, room) {
  const { avg, median, nonNum, dist, maxCount } = computeVoteStats(room.participants);

  let html = '';

  if (avg !== null) {
    html += `
      <div class="stat-item">
        <div class="stat-value">${avg % 1 === 0 ? avg : avg.toFixed(1)}</div>
        <div class="stat-label">${t('stat-average')}</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-value">${median % 1 === 0 ? median : median.toFixed(1)}</div>
        <div class="stat-label">${t('stat-median')}</div>
      </div>
    `;
    if (nonNum.length > 0) html += `<div class="stat-divider"></div>`;
  }

  if (nonNum.length > 0) {
    const counts  = Object.create(null); // card labels as keys — see computeVoteStats
    for (const v of nonNum) counts[v] = (counts[v] || 0) + 1;
    const display = Object.entries(counts).map(([v, c]) => `${escHtml(v)}×${c}`).join(' ');
    html += `
      <div class="stat-item">
        <div class="stat-value" style="font-size:1.2rem;">${display}</div>
        <div class="stat-label">${t('stat-other')}</div>
      </div>
    `;
  }

  if (Object.keys(dist).length > 0) {
    if (html) html += `<div class="stat-divider"></div>`;
    const bars = Object.entries(dist)
      .sort(([a], [b]) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return isNaN(na) ? 1 : -1;
      })
      .map(([v, c]) => {
        const pct = Math.round((c / maxCount) * 100);
        return `
          <div class="dist-row">
            <span class="dist-val">${escHtml(v)}</span>
            <div class="dist-bar-track"><div class="dist-bar-fill" style="width:${pct}%"></div></div>
            <span class="dist-count">${c}×</span>
          </div>`;
      }).join('');

    html += `
      <div class="vote-distribution">
        <div class="vote-distribution-label">${t('stat-distribution')}</div>
        <div class="dist-bars">${bars}</div>
      </div>
    `;
  }

  // Rewriting identical markup would drop the `width` transition on the
  // distribution bars every time an unrelated room-state came in, so the
  // bars restarted from their current width on each one.
  if (container.innerHTML !== html) container.innerHTML = html;
}
