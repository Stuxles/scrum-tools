/**
 * Auto-reveal helper.
 *
 * When a room has `autoReveal` enabled, the votes are revealed automatically
 * as soon as every eligible voter has cast a vote. The Scrum Master and
 * spectators are excluded from the check, matching the progress bar logic.
 */

/**
 * Determine whether the room should flip to revealed right now.
 *
 * @param {object} room
 * @returns {boolean}
 */
export function shouldAutoReveal(room) {
  if (!room || !room.autoReveal || room.revealed) return false;

  const voters = Object.values(room.participants)
    .filter(p => p.id !== room.masterId && !p.isSpectator);

  return voters.length > 0 && voters.every(p => p.hasVoted);
}

/**
 * Reveal the room if the auto-reveal condition is met.
 *
 * @param {object} room
 * @returns {boolean} true when the room was just revealed
 */
export function applyAutoReveal(room) {
  if (!shouldAutoReveal(room)) return false;
  room.revealed = true;
  return true;
}
