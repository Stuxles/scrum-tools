import { rooms, deleteRoom }  from '../../store/rooms.js';
import { broadcastRoomState } from '../../utils/broadcast.js';
import { RECONNECT_GRACE_PERIOD_MS } from '../../config.js';

/**
 * @param {import('socket.io').Server}  io
 * @param {import('socket.io').Socket} socket
 */
export function handleKickUser(io, socket, { roomId, targetId }) {
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

    if (wasMaster) {
      room.masterId = remaining[0];
      io.to(remaining[0]).emit('became-master', {});
    }

    broadcastRoomState(roomId);
  }
}
