import { escHtml } from '../utils/helpers.js';

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

  // Exclude SM (presenter) from vote tallies
  const nonMaster = room.participants.filter(p => !p.isMaster);
  const voters    = nonMaster.filter(p => p.hasVoted);

  resultsSubtitle.textContent = `${voters.length} van ${nonMaster.length} deelnemers stemden`;

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
  const votes   = room.participants.filter(p => !p.isMaster && p.hasVoted).map(p => p.vote);
  const numeric = votes.map(v => parseFloat(v)).filter(v => !isNaN(v));
  const nonNum  = votes.filter(v => isNaN(parseFloat(v)));

  const avg    = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;
  const sorted = [...numeric].sort((a, b) => a - b);
  const median = sorted.length
    ? (sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)])
    : null;

  const dist     = {};
  for (const v of votes) dist[v] = (dist[v] || 0) + 1;
  const maxCount = Math.max(...Object.values(dist), 1);

  let html = '';

  if (avg !== null) {
    html += `
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
    if (nonNum.length > 0) html += `<div class="stat-divider"></div>`;
  }

  if (nonNum.length > 0) {
    const counts  = {};
    for (const v of nonNum) counts[v] = (counts[v] || 0) + 1;
    const display = Object.entries(counts).map(([v, c]) => `${escHtml(v)}×${c}`).join(' ');
    html += `
      <div class="stat-item">
        <div class="stat-value" style="font-size:1.2rem;">${display}</div>
        <div class="stat-label">Overig</div>
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
        <div class="vote-distribution-label">Verdeling</div>
        <div class="dist-bars">${bars}</div>
      </div>
    `;
  }

  container.innerHTML = html;
}
