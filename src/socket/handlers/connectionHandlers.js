import { rooms, deleteRoom }  from '../../store/rooms.js';
import { broadcastRoomState } from '../../utils/broadcast.js';
import { normalizeRoomId }    from '../../utils/roomId.js';
import { applyAutoReveal }    from '../../utils/autoReveal.js';
import { RECONNECT_GRACE_PERIOD_MS, PARTICIPANT_GRACE_MS } from '../../config.js';

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
  console.log(`[grace] ${socketId} verwijderd uit room ${roomId} na ${PARTICIPANT_GRACE_MS / 60000}m zonder reconnect.`);
}

/**
 * @param {import('socket.io').Server}  io
 * @param {import('socket.io').Socket} socket
 */
export function handleDisconnect(io, socket) {
  console.log(`[-] ${socket.id}`);

  for (const [roomId, room] of Object.entries(rooms)) {
    const participant = room.participants[socket.id];
    if (!participant) continue;

    const wasMaster = room.masterId === socket.id;

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
          console.log(`[cleanup] Room ${roomId} deleted after ${RECONNECT_GRACE_PERIOD_MS / 60000}m inactivity.`);
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
        if (rooms[roomId] && rooms[roomId].masterId === socket.id) {
          const rem = Object.entries(rooms[roomId].participants).filter(([, p]) => p.connected !== false);
          if (rem.length > 0) {
            const [newMasterId, newMaster] = rem[0];
            rooms[roomId].masterId   = newMasterId;
            rooms[roomId].masterName = newMaster.name;
            io.to(newMasterId).emit('became-master', {});
            broadcastRoomState(roomId);
            console.log(`[master-grace] Assigned new Scrum Master (${newMasterId}) after 30s timeout in room ${roomId}`);
          }
        }
      }, 30000);
    }

    broadcastRoomState(roomId);
  }
}
