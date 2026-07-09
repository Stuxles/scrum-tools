/**
 * In-memory rooms store + sanitize helper.
 *
 * @typedef {{ id: string, name: string, masterId: string|null, masterName: string,
 *             deckType: string, deck: string[], revealed: boolean,
 *             participants: Record<string,Participant>, createdAt: number,
 *             disconnectTimer?: ReturnType<typeof setTimeout> }} Room
 *
 * @typedef {{ id: string, name: string, vote: string|null, hasVoted: boolean }} Participant
 */

/** @type {Record<string, Room>} */
export const rooms = {};

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
    id:       room.id,
    name:     room.name,
    masterId: room.masterId,
    deckType: room.deckType,
    deck:     room.deck,
    revealed: room.revealed,
    participants: Object.values(room.participants).map(p => ({
      id:       p.id,
      name:     p.name,
      hasVoted: p.hasVoted,
      vote:     (room.revealed || (viewerSocketId && p.id === viewerSocketId)) ? p.vote : null,
      isMaster: p.id === room.masterId,
    })),
  };
}
