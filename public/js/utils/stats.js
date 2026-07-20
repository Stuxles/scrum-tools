/**
 * Pure vote-statistics calculation, extracted from render-results.js so it
 * can be tested without a DOM. Excludes the Scrum Master; callers that also
 * want to exclude spectators should filter beforehand (render-results.js
 * excludes them when building the cards grid, but the historical stats
 * calculation itself only ever excluded the master).
 */

/**
 * @param {Array<{ isMaster: boolean, hasVoted: boolean, vote: string|null }>} participants
 * @returns {{
 *   votes: string[],
 *   numeric: number[],
 *   nonNum: string[],
 *   avg: number|null,
 *   median: number|null,
 *   dist: Record<string, number>,
 *   maxCount: number,
 * }}
 */
export function computeVoteStats(participants) {
  const votes   = participants.filter(p => !p.isMaster && p.hasVoted).map(p => p.vote);
  const numeric = votes.map(v => parseFloat(v)).filter(v => !isNaN(v));
  const nonNum  = votes.filter(v => isNaN(parseFloat(v)));

  const avg    = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;
  const sorted = [...numeric].sort((a, b) => a - b);
  const median = sorted.length
    ? (sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)])
    : null;

  const dist = {};
  for (const v of votes) dist[v] = (dist[v] || 0) + 1;
  const maxCount = Math.max(...Object.values(dist), 1);

  return { votes, numeric, nonNum, avg, median, dist, maxCount };
}
