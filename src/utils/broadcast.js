/**
 * Shared broadcast utilities.
 * Needs a reference to the Socket.IO server (`io`) to be injected.
 */

import { rooms, sanitizeRoom, deleteRoom } from '../store/rooms.js';
import { info } from './logger.js';
import { ROOM_CLEANUP_INTERVAL_MS, RECONNECT_GRACE_PERIOD_MS } from '../config.js';

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
 * Send one event to one socket, for callers that hold no `io` reference of
 * their own — a grace timer firing minutes after the handler that armed it,
 * for instance. A socket that is already gone is simply skipped.
 *
 * @param {string} socketId
 * @param {string} event
 * @param {object} [payload]
 */
export function emitToSocket(socketId, event, payload = {}) {
  _io?.sockets.sockets.get(socketId)?.emit(event, payload);
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
      info('cleanup', `Room ${roomId} still in use after 24h, extended.`);
      scheduleRoomCleanup(roomId);
      return;
    }
    closeRoom(roomId);
    info('cleanup', `Room ${roomId} deleted after 24h of inactivity.`);
  }, ROOM_CLEANUP_INTERVAL_MS);
}

/**
 * Nobody is looking at this room — no connected participant and no presenter
 * screen. Both have to be gone: a team at lunch with the screen still up has
 * not abandoned the room.
 *
 * @param {import('../store/rooms.js').Room} room
 * @returns {boolean}
 */
export function isRoomUnattended(room) {
  if (room.displays?.size) return false;
  return Object.values(room.participants).every(p => p.connected === false);
}

/**
 * Arm the empty-room timer. Re-checks on firing rather than trusting the
 * state at scheduling time, because anyone — participant or screen — may
 * have come back in the meantime.
 *
 * Armed from two places, and the second one is the point: a brand new room is
 * unattended by definition, since creating a room no longer seats anyone (the
 * creator usually lands on the presenter screen, which attaches over a *new*
 * connection). Without this, a room nobody ever joined fell through to the
 * 24h cleanup alone and sat in memory for a full day. `create-room` needs no
 * authentication, so that was a day of memory per message.
 *
 * shortcut: a flood can still hold one grace window's worth of rooms (~30
 * minutes). Add a per-IP room cap if this is ever exposed to untrusted
 * traffic rather than a team LAN or an authenticated reverse proxy.
 *
 * @param {string} roomId
 */
export function scheduleEmptyRoomCleanup(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.disconnectTimer) clearTimeout(room.disconnectTimer);

  room.disconnectTimer = setTimeout(() => {
    const r = rooms[roomId];
    if (!r || !isRoomUnattended(r)) return;
    closeRoom(roomId);
    info('cleanup', `Room ${roomId} deleted after ${RECONNECT_GRACE_PERIOD_MS / 60000}m inactivity.`);
  }, RECONNECT_GRACE_PERIOD_MS);
}
