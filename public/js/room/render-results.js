import { escHtml } from '../utils/helpers.js';
import { t }       from '../utils/i18n.js';
import { computeVoteStats } from '../utils/stats.js';

/**
 * Results phase renderer — cards grid and statistics panel.
 *
 * @param {object} ctx  Elements: votingPhase, resultsPhase, resultsSubtitle,
 *                      resultsCardsGrid, resultsStats
 * @param {object} room
 */
export function renderResults(ctx, room) {
  const { votingPhase, resultsPhase, resultsSubtitle, resultsCardsGrid, resultsStats } = ctx;

  votingPhase.classList.add('hidden');
  resultsPhase.classList.remove('hidden');

  // Exclude SM (presenter) and spectators from vote tallies
  const nonMaster = room.participants.filter(p => !p.isMaster && !p.isSpectator);
  const voters    = nonMaster.filter(p => p.hasVoted);

  resultsSubtitle.textContent = t('progress-text', { voted: voters.length, total: nonMaster.length });

  // ── Cards grid ────────────────────────────────────────────────────────────
  resultsCardsGrid.innerHTML = '';
  for (const p of nonMaster) {
    const div  = document.createElement('div');
    div.className = 'result-card';
    div.setAttribute('role', 'listitem');

    const face = document.createElement('div');
    face.className   = p.hasVoted ? 'result-card-face' : 'result-card-face no-vote';
    face.textContent = p.hasVoted ? (p.vote || '—') : '—';

    const nameEl = document.createElement('div');
    nameEl.className   = 'result-card-name';
    nameEl.textContent = p.name;
    nameEl.title       = p.name;

    div.appendChild(face);
    div.appendChild(nameEl);
    resultsCardsGrid.appendChild(div);
  }

  // ── Statistics ────────────────────────────────────────────────────────────
  renderStats(resultsStats, room);
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
    const counts  = {};
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

  container.innerHTML = html;
}
