/**
 * Shared broadcast utilities.
 * Needs a reference to the Socket.IO server (`io`) to be injected.
 */

import { rooms, sanitizeRoom } from '../store/rooms.js';

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
}

/**
 * Schedule automatic cleanup of a room after 24 hours.
 *
 * @param {string} roomId
 */
export function scheduleRoomCleanup(roomId) {
  setTimeout(() => {
    if (rooms[roomId]) {
      delete rooms[roomId];
      console.log(`[cleanup] Room ${roomId} verwijderd na 24u.`);
    }
  }, 24 * 60 * 60 * 1000);
}
