/**
 * Auto-reveal helper.
 *
 * When a room has `autoReveal` enabled, the votes are revealed automatically
 * as soon as every eligible voter has cast a vote. The Scrum Master and
 * spectators are excluded from the check, matching the progress bar logic.
 */

import { info } from './logger.js';

/**
 * Everyone whose vote the round is waiting on: every participant that is not
 * a spectator. Shared by the auto-reveal check and the reveal logging so the
 * two can never disagree about who counts.
 *
 * The host is an ordinary voter. Presenting is a separate thing now — a
 * presenter screen is not a participant at all (see `room.displays`) — so
 * holding the role no longer implies sitting a round out. A host who does not
 * want to vote toggles spectator, same as anyone else.
 *
 * @param {object} room
 * @returns {Array<object>}
 */
function eligibleVoters(room) {
  return Object.values(room.participants).filter(p => !p.isSpectator);
}

/**
 * How many eligible voters have voted, out of how many.
 *
 * @param {object} room
 * @returns {{ voted: number, total: number }}
 */
export function countVoters(room) {
  const voters = eligibleVoters(room);
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

  const voters = eligibleVoters(room);

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
