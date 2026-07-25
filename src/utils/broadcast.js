/**
 * Shared broadcast utilities.
 * Needs a reference to the Socket.IO server (`io`) to be injected.
 */

import { rooms, sanitizeRoom, deleteRoom } from '../store/rooms.js';
import { info } from './logger.js';
import { ROOM_CLEANUP_INTERVAL_MS } from '../config.js';

/** @type {import('socket.io').Server} */
let _io;

/** @param {import('socket.io').Server} io */
export function initBroadcast(io) {
  _io = io;
}

/**
 * Emit the current room state individually to every participant,
 * so each client only sees their own vote before reveal.
 *
 * Presenter screens get the same state with no viewer id, which is the
 * strictest view there is: no votes at all until the room is revealed.
 * A screen is not a person, so it has no own vote to be shown early.
 *
 * @param {string} roomId
 */
export function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  for (const p of Object.values(room.participants)) {
    const socket = _io.sockets.sockets.get(p.id);
    if (socket) {
      socket.emit('room-state', { room: sanitizeRoom(room, p.id) });
    }
  }

  if (room.displays?.size) {
    const displayState = { room: sanitizeRoom(room, null) };
    for (const id of room.displays) {
      _io.sockets.sockets.get(id)?.emit('room-state', displayState);
    }
  }
}

/**
 * Tell any presenter screens still watching that the room is gone, then
 * delete it. Participants need no such signal — a room is only ever removed
 * once they have all disconnected — but a display can still be attached when
 * the 24h cleanup fires, and would otherwise sit on stale state forever.
 *
 * @param {string} roomId
 */
export function closeRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  for (const id of room.displays ?? []) {
    _io?.sockets.sockets.get(id)?.emit('room-closed', { roomId });
  }
  deleteRoom(roomId);
}

/**
 * Schedule automatic cleanup of a room after 24 hours.
 * Stores timer on `room.cleanupTimer` to avoid memory leaks if room is deleted earlier.
 *
 * @param {string} roomId
 */
export function scheduleRoomCleanup(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);

  room.cleanupTimer = setTimeout(() => {
    const r = rooms[roomId];
    if (!r) return;
    // Deliberately ignores displays: a room nobody has joined in 24 hours is
    // done, even if a forgotten screen is still pointed at it.
    if (Object.keys(r.participants).length > 0) {
      info('cleanup', `Room ${roomId} nog in gebruik na 24u, verlengd.`);
      scheduleRoomCleanup(roomId);
      return;
    }
    closeRoom(roomId);
    info('cleanup', `Room ${roomId} verwijderd na 24u inactiviteit.`);
  }, ROOM_CLEANUP_INTERVAL_MS);
}
