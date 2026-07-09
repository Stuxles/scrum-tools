import { rooms }            from '../../store/rooms.js';
import { DECKS }            from '../../config.js';
import { broadcastRoomState } from '../../utils/broadcast.js';

/** @param {import('socket.io').Socket} socket */
export function handleReveal(socket, { roomId }) {
  const room = rooms[roomId];
  if (!room || room.masterId !== socket.id) return;

  room.revealed = true;
  broadcastRoomState(roomId);
}

/** @param {import('socket.io').Socket} socket */
export function handleReset(socket, { roomId }) {
  const room = rooms[roomId];
  if (!room || room.masterId !== socket.id) return;

  room.revealed = false;
  for (const p of Object.values(room.participants)) {
    p.vote     = null;
    p.hasVoted = false;
  }
  broadcastRoomState(roomId);
}

/** @param {import('socket.io').Socket} socket */
export function handleChangeDeck(socket, { roomId, deckType, customCards }) {
  const room = rooms[roomId];
  if (!room || room.masterId !== socket.id) return;

  if (deckType === 'custom') {
    const cards = (customCards || []).map(s => String(s).trim().slice(0, 10)).filter(Boolean).slice(0, 30);
    if (cards.length < 2) {
      socket.emit('error', { message: 'Voer minimaal 2 kaarten in.' });
      return;
    }
    room.deck = cards;
  } else if (DECKS[deckType]) {
    room.deck = DECKS[deckType];
  } else {
    return;
  }

  room.deckType = deckType;
  room.revealed = false;
  for (const p of Object.values(room.participants)) {
    p.vote     = null;
    p.hasVoted = false;
  }
  broadcastRoomState(roomId);
}

/** @param {import('socket.io').Socket} socket */
export function handleUpdateName(socket, { roomId, name }) {
  const room = rooms[roomId];
  if (!room || !room.participants[socket.id]) return;

  name = (name || '').trim().slice(0, 40);
  if (!name) return;

  // Keep masterName in sync when the SM renames themselves
  if (room.masterId === socket.id) room.masterName = name;

  room.participants[socket.id].name = name;
  broadcastRoomState(roomId);
}
