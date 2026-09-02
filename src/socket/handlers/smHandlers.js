import { rooms, canControlRoom } from '../../store/rooms.js';
import { DECKS }            from '../../config.js';
import { broadcastRoomState } from '../../utils/broadcast.js';
import { normalizeRoomId }  from '../../utils/roomId.js';
import { applyAutoReveal, countVoters } from '../../utils/autoReveal.js';
import { info }             from '../../utils/logger.js';

/** @param {import('socket.io').Socket} socket */
export function handleReveal(socket, { roomId }) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !canControlRoom(room, socket.id) || room.revealed) return;

  room.revealed = true;
  const { voted, total } = countVoters(room);
  info('reveal', `${roomId}: ${voted}/${total} gestemd`);
  broadcastRoomState(roomId);
}

/** @param {import('socket.io').Socket} socket */
export function handleReset(socket, { roomId }) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !canControlRoom(room, socket.id)) return;

  info('reset', `${roomId}: nieuwe ronde`);
  room.revealed = false;
  for (const p of Object.values(room.participants)) {
    p.vote     = null;
    p.hasVoted = false;
  }
  broadcastRoomState(roomId);
}

/** @param {import('socket.io').Socket} socket */
export function handleChangeDeck(socket, { roomId, deckType, customCards }) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !canControlRoom(room, socket.id)) return;

  if (deckType === 'custom') {
    const cards = (customCards || []).map(s => String(s).trim().slice(0, 10)).filter(Boolean).slice(0, 30);
    if (cards.length < 2) {
      socket.emit('error', { message: 'Voer minimaal 2 kaarten in.' });
      return;
    }
    room.deck = cards;
  } else if (DECKS[deckType]) {
    room.deck = [...DECKS[deckType]]; // copy, never alias the shared preset
  } else {
    return;
  }

  info('change-deck', `${roomId}: ${deckType} (${room.deck.length} kaarten)`);
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
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !room.participants[socket.id]) return;

  name = (name || '').trim().slice(0, 40);
  if (!name) return;

  // Keep masterName in sync when the SM renames themselves
  if (room.masterId === socket.id) room.masterName = name;

  room.participants[socket.id].name = name;
  broadcastRoomState(roomId);
}

/**
 * Toggle automatic reveal (`toggle-auto-reveal`). Scrum Master only.
 * Enabling it while everyone has already voted reveals immediately.
 *
 * @param {import('socket.io').Socket} socket
 */
export function handleToggleAutoReveal(socket, { roomId, autoReveal }) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !canControlRoom(room, socket.id)) return;

  room.autoReveal = Boolean(autoReveal);
  if (room.autoReveal) applyAutoReveal(room);
  broadcastRoomState(roomId);
}

/** @param {import('socket.io').Socket} socket */
export function handleUpdateStoryTitle(socket, { roomId, storyTitle }) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !canControlRoom(room, socket.id)) return;

  room.storyTitle = String(storyTitle || '').trim().slice(0, 200);
  broadcastRoomState(roomId);
}
