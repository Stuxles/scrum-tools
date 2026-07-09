import { rooms, sanitizeRoom } from '../../store/rooms.js';
import { DECKS }               from '../../config.js';
import { generateRoomId }      from '../../utils/roomId.js';
import {
  broadcastRoomState,
  scheduleRoomCleanup,
} from '../../utils/broadcast.js';

/** @param {import('socket.io').Socket} socket */
export function handleCreateRoom(socket, { name, deckType, customCards, roomName }) {
  name     = (name     || 'Anoniem').trim().slice(0, 40);
  roomName = (roomName || `${name}'s Room`).trim().slice(0, 60);
  deckType = DECKS[deckType] ? deckType : 'standard';

  const deck = deckType === 'custom'
    ? (customCards || []).map(s => String(s).trim().slice(0, 10)).filter(Boolean).slice(0, 30)
    : DECKS[deckType];

  if (deckType === 'custom' && deck.length < 2) {
    socket.emit('error', { message: 'Voer minimaal 2 kaarten in voor een aangepast deck.' });
    return;
  }

  let roomId;
  let attempts = 0;
  do {
    roomId = generateRoomId();
    if (++attempts > 100) {
      socket.emit('error', { message: 'Kon geen unieke room-code genereren. Server zit vol.' });
      return;
    }
  } while (rooms[roomId]);

  rooms[roomId] = {
    id:           roomId,
    name:         roomName,
    masterId:     null,
    masterName:   name,   // used to re-identify creator on reconnect
    deckType,
    deck,
    revealed:     false,
    participants: {},
    createdAt:    Date.now(),
  };

  scheduleRoomCleanup(roomId);
  socket.emit('room-created', { roomId });
  console.log(`[room] ${roomId} aangemaakt door ${name}`);
}

/** @param {import('socket.io').Socket} socket */
export function handleJoinRoom(socket, { roomId, name }) {
  roomId = (roomId || '').trim().toUpperCase();
  name   = (name   || 'Anoniem').trim().slice(0, 40);

  const room = rooms[roomId];
  if (!room) {
    socket.emit('error', { message: `Room "${roomId}" niet gevonden. Controleer de code.` });
    return;
  }

  // Cancel pending deletion if creator reconnects
  if (room.disconnectTimer) {
    clearTimeout(room.disconnectTimer);
    delete room.disconnectTimer;
  }

  // Assign master: only when room has no master or current master is disconnected
  if (!room.masterId || !room.participants[room.masterId]) {
    room.masterId   = socket.id;
    room.masterName = name;
  }

  // Allow rejoin (e.g. page refresh) — only create entry if absent
  room.participants[socket.id] = room.participants[socket.id] || {
    id: socket.id, name, vote: null, hasVoted: false,
  };
  room.participants[socket.id].name = name;

  socket.join(roomId);

  const isMaster = room.masterId === socket.id;
  socket.emit('room-joined', { room: sanitizeRoom(room, socket.id), isMaster });
  broadcastRoomState(roomId);

  console.log(`[join] ${name} → ${roomId}`);
}

/** @param {import('socket.io').Socket} socket */
export function handleVote(socket, { roomId, vote }) {
  const room = rooms[roomId];
  if (!room || !room.participants[socket.id]) return;
  if (room.revealed) return;

  if (vote === null || vote === '' || vote === undefined) {
    room.participants[socket.id].vote     = null;
    room.participants[socket.id].hasVoted = false;
    broadcastRoomState(roomId);
    return;
  }

  const voteStr = String(vote).trim().slice(0, 20);
  if (!room.deck.includes(voteStr)) return;

  room.participants[socket.id].vote     = voteStr;
  room.participants[socket.id].hasVoted = true;
  broadcastRoomState(roomId);
}
