/**
 * In-memory rooms store + sanitize helper.
 *
 * @typedef {{ id: string, name: string, masterId: string|null, masterName: string,
 *             masterToken: string|null,
 *             deckType: string, deck: string[], revealed: boolean,
 *             participants: Record<string,Participant>, createdAt: number,
 *             disconnectTimer?: ReturnType<typeof setTimeout>,
 *             cleanupTimer?: ReturnType<typeof setTimeout>,
 *             masterGraceTimer?: ReturnType<typeof setTimeout>,
 *             participantGraceTimers?: Record<string, ReturnType<typeof setTimeout>> }} Room
 *
 * @typedef {{ id: string, name: string, vote: string|null, hasVoted: boolean,
 *             sessionToken?: string, connected?: boolean,
 *             disconnectedAt?: number|null }} Participant
 *
 * `sessionToken` is a per-client secret and is deliberately absent from
 * `sanitizeRoom` output — it must never reach anyone but its owner.
 */

/**
 * Null-prototype map so client-supplied room IDs like `__proto__` or
 * `constructor` resolve to `undefined` instead of a truthy prototype value.
 * @type {Record<string, Room>}
 */
export const rooms = Object.create(null);

/**
 * Delete a room and clear any pending timers to avoid memory/timer leaks.
 * @param {string} roomId
 */
export function deleteRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.cleanupTimer)    clearTimeout(room.cleanupTimer);
  if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
  if (room.masterGraceTimer) clearTimeout(room.masterGraceTimer);
  if (room.participantGraceTimers) {
    for (const timer of Object.values(room.participantGraceTimers)) clearTimeout(timer);
  }
  delete rooms[roomId];
}

/**
 * Serialize room state for a specific client.
 * Votes are hidden unless the room is revealed or it's the viewer's own vote.
 *
 * @param {Room}   room
 * @param {string} [viewerSocketId]
 * @returns {object}
 */
export function sanitizeRoom(room, viewerSocketId = null) {
  return {
    id:         room.id,
    name:       room.name,
    masterId:   room.masterId,
    deckType:   room.deckType,
    deck:       room.deck,
    revealed:   room.revealed,
    autoReveal: Boolean(room.autoReveal),
    storyTitle: room.storyTitle || '',
    participants: Object.values(room.participants).map(p => ({
      id:          p.id,
      name:        p.name,
      hasVoted:    p.hasVoted,
      vote:        (room.revealed || (viewerSocketId && p.id === viewerSocketId)) ? p.vote : null,
      isMaster:    p.id === room.masterId,
      isSpectator: Boolean(p.isSpectator),
      connected:   p.connected !== false,
    })),
  };
}
