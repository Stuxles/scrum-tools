/**
 * Auto-reveal helper.
 *
 * When a room has `autoReveal` enabled, the votes are revealed automatically
 * as soon as every eligible voter has cast a vote. The Scrum Master and
 * spectators are excluded from the check, matching the progress bar logic.
 */

import { info } from './logger.js';
// The one definition of who a round is waiting for, shared with the browser
// rather than mirrored here. The server reveals on it and the progress bar is
// drawn from it, so a second copy could only ever drift into the server
// revealing at 3/3 while the bar on screen still reads 3/4 — which is exactly
// how the offline-voter bug got through. `src/config.js` already imports from
// `public/` the same way, and the Dockerfile copies both trees.
import { eligibleVoters } from '../../public/js/utils/stats.js';

/** @param {object} room @returns {Array<object>} */
const votersIn = (room) => eligibleVoters(Object.values(room.participants));

/**
 * How many eligible voters have voted, out of how many.
 *
 * @param {object} room
 * @returns {{ voted: number, total: number }}
 */
export function countVoters(room) {
  const voters = votersIn(room);
  return { voted: voters.filter(p => p.hasVoted).length, total: voters.length };
}

/**
 * Determine whether the room should flip to revealed right now.
 *
 * @param {object} room
 * @returns {boolean}
 */
export function shouldAutoReveal(room) {
  if (!room || !room.autoReveal || room.revealed) return false;

  const voters = votersIn(room);

  return voters.length > 0 && voters.every(p => p.hasVoted);
}

/**
 * Reveal the room if the auto-reveal condition is met.
 *
 * Logs here rather than at the call sites: auto-reveal can fire from a vote,
 * a spectator toggle, a kick, a disconnect or an expiring grace timer, and a
 * single line here catches all of them.
 *
 * @param {object} room
 * @returns {boolean} true when the room was just revealed
 */
export function applyAutoReveal(room) {
  if (!shouldAutoReveal(room)) return false;
  room.revealed = true;
  const { total } = countVoters(room);
  info('auto-reveal', `${room.id || '?'}: ${total} stemmers, iedereen heeft gestemd`);
  return true;
}
