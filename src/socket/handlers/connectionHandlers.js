import { rooms, deleteRoom }  from '../../store/rooms.js';
import { broadcastRoomState } from '../../utils/broadcast.js';
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
  if (!room || room.masterId !== socket.id || targetId === socket.id) return;

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
  delete room.participants[targetId];
  // The remaining voters may now all have voted
  applyAutoReveal(room);
  broadcastRoomState(roomId);
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

  delete room.participants[socketId];
  if (room.participantGraceTimers) delete room.participantGraceTimers[socketId];
  applyAutoReveal(room);
  broadcastRoomState(roomId);
  info('grace', `${socketId} verwijderd uit room ${roomId} na ${PARTICIPANT_GRACE_MS / 60000}m zonder reconnect.`);
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
      if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
      // Grace period: give participants time to reconnect before wiping an empty room
      room.disconnectTimer = setTimeout(() => {
        const r = rooms[roomId];
        if (r && Object.values(r.participants).every(p => p.connected === false)) {
          deleteRoom(roomId);
          info('cleanup', `Room ${roomId} deleted after ${RECONNECT_GRACE_PERIOD_MS / 60000}m inactivity.`);
        }
      }, RECONNECT_GRACE_PERIOD_MS);
      broadcastRoomState(roomId);
      continue;
    }

    // A pending voter leaving may complete the round
    applyAutoReveal(room);

    if (wasMaster) {
      if (room.masterGraceTimer) clearTimeout(room.masterGraceTimer);
      room.masterGraceTimer = setTimeout(() => {
        const r = rooms[roomId];
        if (!r) return;

        // Clear the handle first, on every path. A fired-but-still-set timer
        // reads as truthy forever, which permanently armed the reclaim branch
        // in handleJoinRoom and permanently disabled its auto-master fallback.
        r.masterGraceTimer = null;

        if (r.masterId !== socket.id) return;

        const rem = Object.entries(r.participants).filter(([, p]) => p.connected !== false);
        if (rem.length === 0) return; // nobody to hand it to; next joiner takes it

        const [newMasterId, newMaster] = rem[0];
        r.masterId    = newMasterId;
        r.masterName  = newMaster.name;
        r.masterToken = newMaster.sessionToken || null;
        io.to(newMasterId).emit('became-master', {});
        broadcastRoomState(roomId);
        info('master-grace', `Assigned new Scrum Master (${newMasterId}) after ${MASTER_GRACE_MS / 1000}s timeout in room ${roomId}`);
      }, MASTER_GRACE_MS);
    }

    broadcastRoomState(roomId);
  }

  if (!wasInAnyRoom) info('disconnect', socket.id);
}
