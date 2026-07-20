import { rooms, deleteRoom }  from '../../store/rooms.js';
import { broadcastRoomState } from '../../utils/broadcast.js';
import { normalizeRoomId }    from '../../utils/roomId.js';
import { applyAutoReveal }    from '../../utils/autoReveal.js';
import { RECONNECT_GRACE_PERIOD_MS } from '../../config.js';

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
  delete room.participants[targetId];
  // The remaining voters may now all have voted
  applyAutoReveal(room);
  broadcastRoomState(roomId);
}

/**
 * @param {import('socket.io').Server}  io
 * @param {import('socket.io').Socket} socket
 */
export function handleDisconnect(io, socket) {
  console.log(`[-] ${socket.id}`);

  for (const [roomId, room] of Object.entries(rooms)) {
    if (!room.participants[socket.id]) continue;

    const wasMaster = room.masterId === socket.id;
    delete room.participants[socket.id];

    const remaining = Object.keys(room.participants);

    if (remaining.length === 0) {
      if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
      // Grace period: give participants time to reconnect before wiping an empty room
      room.disconnectTimer = setTimeout(() => {
        if (rooms[roomId] && Object.keys(rooms[roomId].participants).length === 0) {
          deleteRoom(roomId);
          console.log(`[cleanup] Room ${roomId} deleted after ${RECONNECT_GRACE_PERIOD_MS / 60000}m inactivity.`);
        }
      }, RECONNECT_GRACE_PERIOD_MS);
      continue;
    }

    // A pending voter leaving may complete the round
    applyAutoReveal(room);

    if (wasMaster && remaining.length > 0) {
      if (room.masterGraceTimer) clearTimeout(room.masterGraceTimer);
      room.masterGraceTimer = setTimeout(() => {
        if (rooms[roomId] && rooms[roomId].masterId === socket.id) {
          const rem = Object.keys(rooms[roomId].participants);
          if (rem.length > 0) {
            rooms[roomId].masterId = rem[0];
            const newMaster = rooms[roomId].participants[rem[0]];
            if (newMaster) rooms[roomId].masterName = newMaster.name;
            io.to(rem[0]).emit('became-master', {});
            broadcastRoomState(roomId);
            console.log(`[master-grace] Assigned new Scrum Master (${rem[0]}) after 30s timeout in room ${roomId}`);
          }
        }
      }, 30000);
    }

    broadcastRoomState(roomId);
  }
}
