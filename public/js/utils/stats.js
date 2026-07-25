/**
 * Pure vote-statistics calculation, extracted from render-results.js so it
 * can be tested without a DOM.
 *
 * Counts every participant that actually voted. The host is an ordinary voter
 * now that presenting is a separate thing, and spectators never have
 * `hasVoted` set, so they drop out on their own.
 */

/**
 * @param {Array<{ hasVoted: boolean, vote: string|null }>} participants
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
  const votes   = participants.filter(p => p.hasVoted).map(p => p.vote);
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

/**
 * True when every eligible voter voted and they all picked the exact same
 * card (numeric or not, e.g. all "❓" counts as consensus too).
 * Requires at least 2 voters — one person "agreeing with themselves"
 * isn't a celebration-worthy consensus.
 *
 * @param {string[]} votes         The `votes` array from computeVoteStats.
 * @param {number}   eligibleCount Total non-master, non-spectator participants.
 * @returns {boolean}
 */
export function isUnanimousConsensus(votes, eligibleCount) {
  return eligibleCount >= 2
    && votes.length === eligibleCount
    && new Set(votes).size === 1;
}
