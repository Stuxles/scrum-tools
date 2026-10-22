import { rooms, canControlRoom } from '../../store/rooms.js';
import { broadcastRoomState, closeRoom, emitToSocket } from '../../utils/broadcast.js';
import { normalizeRoomId }    from '../../utils/roomId.js';
import { applyAutoReveal }    from '../../utils/autoReveal.js';
import { RECONNECT_GRACE_PERIOD_MS, PARTICIPANT_GRACE_MS, MASTER_GRACE_MS } from '../../config.js';
import { info }                from '../../utils/logger.js';

/**
 * @param {import('socket.io').Server}  io
 * @param {import('socket.io').Socket} socket
 */
export function handleKickUser(io, socket, { roomId, targetId }) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !canControlRoom(room, socket.id) || targetId === socket.id) return;

  const target = io.sockets.sockets.get(targetId);
  if (target) {
    target.emit('kicked', {});
    target.leave(roomId);
  } else {
    io.to(targetId).emit('kicked', {});
  }
  if (room.participantGraceTimers?.[targetId]) {
    clearTimeout(room.participantGraceTimers[targetId]);
    delete room.participantGraceTimers[targetId];
  }
  const wasMaster = room.masterId === targetId;
  delete room.participants[targetId];

  // Deleting the seat used to leave masterId pointing at it. The room then had
  // no reachable host, and — because an absent master with no grace timer is
  // what hands the role to the next joiner — the person just kicked got it
  // straight back on rejoin. A kick is deliberate and final, so unlike a
  // disconnect it gets no grace window: hand the role on right now.
  if (wasMaster) {
    if (room.masterGraceTimer) {
      clearTimeout(room.masterGraceTimer);
      room.masterGraceTimer = null;
    }
    const heir = Object.values(room.participants).find(p => p.connected !== false);
    room.masterId    = heir ? heir.id : null;
    room.masterName  = heir ? heir.name : '';
    room.masterToken = heir ? (heir.sessionToken || null) : null;
    if (heir) {
      io.to(heir.id).emit('became-master', {});
      info('kick', `SM ${targetId} gekickt uit ${roomId}; rol naar ${heir.name}`);
    } else {
      info('kick', `SM ${targetId} gekickt uit ${roomId}; niemand over om de rol aan te geven`);
    }
  }

  // The remaining voters may now all have voted
  applyAutoReveal(room);
  broadcastRoomState(roomId);
}

/**
 * Nobody is looking at this room any more — no connected participant and no
 * presenter screen. Both have to be gone: a team at lunch with the screen
 * still up has not abandoned the room.
 *
 * @param {import('../../store/rooms.js').Room} room
 * @returns {boolean}
 */
function isRoomUnattended(room) {
  if (room.displays?.size) return false;
  return Object.values(room.participants).every(p => p.connected === false);
}

/**
 * Arm the empty-room timer. Re-checks on firing rather than trusting the
 * state at scheduling time, because anyone — participant or screen — may
 * have come back in the meantime.
 *
 * @param {string} roomId
 */
function scheduleEmptyRoomCleanup(roomId) {
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

/**
 * Fully remove a participant that never reconnected within its grace window.
 * Exported for direct unit testing (avoids waiting out the real timer).
 * @param {string} roomId
 * @param {string} socketId
 */
export function expireParticipantGrace(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return;
  const p = room.participants[socketId];
  if (!p || p.connected !== false) return; // already reconnected or already gone

  const name      = p.name || socketId;
  const wasMaster = room.masterId === socketId;

  delete room.participants[socketId];
  if (room.participantGraceTimers) delete room.participantGraceTimers[socketId];

  // This is where an absent host's claim finally runs out, so it is also
  // where the role has to move on. `handleJoinRoom` no longer hands the seat
  // to whoever reconnects first while the host is merely away — their claim
  // outlives the 30s promotion timer now — which leaves this expiry as the
  // moment the room would otherwise be left hostless with nobody joining to
  // notice. Same rule as a kick: straight to the first connected survivor.
  if (wasMaster) {
    if (room.masterGraceTimer) {
      clearTimeout(room.masterGraceTimer);
      room.masterGraceTimer = null;
    }
    const heir = Object.values(room.participants).find(q => q.connected !== false);
    room.masterId    = heir ? heir.id : null;
    room.masterName  = heir ? heir.name : '';
    room.masterToken = heir ? (heir.sessionToken || null) : null;
    if (heir) {
      emitToSocket(heir.id, 'became-master');
      info('grace', `SM ${name} verlopen in ${roomId}; rol naar ${heir.name}`);
    }
  }

  applyAutoReveal(room);
  broadcastRoomState(roomId);
  info('grace', `${name} verwijderd uit room ${roomId} na ${PARTICIPANT_GRACE_MS / 60000}m zonder reconnect.`);
}

/**
 * Hold the departed host's claim on the role, and hand it on once there is
 * somebody present to hand it to.
 *
 * `room.masterGraceTimer` is what `handleJoinRoom` reads as "the host's claim
 * is still open", so the timer has to stay armed for as long as that is true.
 * It used to give up on the one firing that found nobody connected — which is
 * the normal state during an outage that took out the whole room, phones and
 * screen together. The claim then evaporated 30 seconds in, and the role went
 * to whichever phone reconnected first; the real host, back moments later with
 * the master token, had already been written out of it. Re-arming instead
 * means a reconnect race no longer decides who runs the session.
 *
 * It does not reserve the seat forever: the claim ends when the host's own
 * participant grace window runs out (`expireParticipantGrace` hands the role
 * on from there), when the room is deleted (`deleteRoom` clears this timer),
 * or on this firing, as soon as anyone is actually around to take over.
 *
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {string} masterSocketId  The seat the claim belongs to.
 */
function scheduleMasterHandover(io, roomId, masterSocketId) {
  const room = rooms[roomId];
  if (!room) return;
  if (room.masterGraceTimer) clearTimeout(room.masterGraceTimer);
  room.masterGraceTimer = setTimeout(() => runMasterHandover(io, roomId, masterSocketId), MASTER_GRACE_MS);
}

/**
 * The claim window closing: hand the role to someone present, or hold it open
 * for another window if there is nobody. Exported for direct unit testing
 * (avoids waiting out the real 30s timer), same as `expireParticipantGrace`.
 *
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 * @param {string} masterSocketId
 */
export function runMasterHandover(io, roomId, masterSocketId) {
  const room = rooms[roomId];
  if (!room) return;

  // Clear the handle first, on every path. A fired-but-still-set timer
  // reads as truthy forever, which permanently armed the reclaim branch
  // in handleJoinRoom and permanently disabled its auto-master fallback.
  room.masterGraceTimer = null;

  if (room.masterId !== masterSocketId) return;

  const rem = Object.entries(room.participants).filter(([, p]) => p.connected !== false);
  if (rem.length === 0) {
    // Nobody to hand it to. Keep the claim open rather than dropping it: an
    // empty room is nobody's to run, and the host may still be mid-blip.
    scheduleMasterHandover(io, roomId, masterSocketId);
    return;
  }

  const [newMasterId, newMaster] = rem[0];
  room.masterId    = newMasterId;
  room.masterName  = newMaster.name;
  room.masterToken = newMaster.sessionToken || null;
  io.to(newMasterId).emit('became-master', {});
  broadcastRoomState(roomId);
  info('master-grace', `Assigned new Scrum Master (${newMasterId}) after ${MASTER_GRACE_MS / 1000}s timeout in room ${roomId}`);
}

/**
 * @param {import('socket.io').Server}  io
 * @param {import('socket.io').Socket} socket
 */
export function handleDisconnect(io, socket) {
  // Log the display name where we have one — a bare socket id means having to
  // scroll back through the log to work out who left. Sockets that never
  // joined a room (someone opening a page and leaving again) still log the id.
  let wasInAnyRoom = false;

  // Presenter screens: no seat to keep, nothing to grace. Just detach, and
  // start the empty-room countdown if that was the last thing watching.
  for (const [roomId, room] of Object.entries(rooms)) {
    if (!room.displays?.has(socket.id)) continue;

    wasInAnyRoom = true;
    room.displays.delete(socket.id);
    info('disconnect', `presenter-scherm ← ${roomId} (${room.displays.size} over)`);
    if (isRoomUnattended(room)) scheduleEmptyRoomCleanup(roomId);
  }

  for (const [roomId, room] of Object.entries(rooms)) {
    const participant = room.participants[socket.id];
    if (!participant) continue;

    wasInAnyRoom = true;
    const wasMaster = room.masterId === socket.id;
    info('disconnect', `${participant.name} ← ${roomId}${wasMaster ? ' (was SM)' : ''}`);

    // Keep the participant's seat (vote, role, spectator state) for a
    // personal grace window instead of removing them immediately, so a
    // brief network drop (e.g. a phone locking its screen) doesn't drop
    // them out of the room or lose their vote.
    participant.connected      = false;
    participant.disconnectedAt = Date.now();

    if (!room.participantGraceTimers) room.participantGraceTimers = {};
    if (room.participantGraceTimers[socket.id]) clearTimeout(room.participantGraceTimers[socket.id]);
    room.participantGraceTimers[socket.id] = setTimeout(
      () => expireParticipantGrace(roomId, socket.id),
      PARTICIPANT_GRACE_MS,
    );

    const activeRemaining = Object.values(room.participants).filter(p => p.connected !== false);

    if (activeRemaining.length === 0) {
      broadcastRoomState(roomId);
      // A presenter screen still watching keeps the room alive; the countdown
      // then starts when that screen closes instead.
      if (isRoomUnattended(room)) scheduleEmptyRoomCleanup(roomId);
      continue;
    }

    // A pending voter leaving may complete the round
    applyAutoReveal(room);

    if (wasMaster) scheduleMasterHandover(io, roomId, socket.id);

    broadcastRoomState(roomId);
  }

  if (!wasInAnyRoom) info('disconnect', socket.id);
}
