import { rooms, sanitizeRoom } from '../../store/rooms.js';
import { DECKS }               from '../../config.js';
import { generateRoomId, normalizeRoomId } from '../../utils/roomId.js';
import {
  broadcastRoomState,
  scheduleRoomCleanup,
} from '../../utils/broadcast.js';
import { applyAutoReveal }     from '../../utils/autoReveal.js';

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
    storyTitle:   '',
    revealed:     false,
    autoReveal:   false,
    participants: {},
    createdAt:    Date.now(),
  };

  scheduleRoomCleanup(roomId);
  socket.emit('room-created', { roomId });
  console.log(`[room] ${roomId} aangemaakt door ${name}`);
}

/** @param {import('socket.io').Socket} socket */
export function handleJoinRoom(socket, { roomId, name, isSpectator }) {
  roomId = normalizeRoomId(roomId);
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

  // Assign master or reconnect gracefully within 30s.
  //
  // TRUST MODEL: reconnect-as-master is gated only on a case-insensitive
  // display-name match during the grace window. This means anyone who joins
  // using the departed Scrum Master's name while masterGraceTimer is pending
  // is handed the master role. This is an accepted trade-off for a
  // frictionless, account-less reconnect flow. Hardening this would require
  // issuing a per-session reconnect token on room-created/room-joined and
  // verifying it here instead of comparing names. See docs/wiki/roles.md.
  if (room.masterGraceTimer && room.masterName && room.masterName.trim().toLowerCase() === name.trim().toLowerCase()) {
    clearTimeout(room.masterGraceTimer);
    room.masterGraceTimer = null;
    room.masterId   = socket.id;
    room.masterName = name;
    console.log(`[master-grace] ${name} reclaimed SM by name match in room ${roomId}`);
  } else if (!room.masterId || (!room.participants[room.masterId] && !room.masterGraceTimer)) {
    room.masterId   = socket.id;
    room.masterName = name;
  }

  // Reconnect: a disconnected participant gets a NEW socket.id, so migrate
  // their old (still-graced) seat — vote, role, spectator state — to the
  // new id by matching display name, instead of losing it and starting
  // fresh. Mirrors the master-reclaim-by-name pattern above.
  const staleEntry = Object.entries(room.participants).find(
    ([id, p]) => id !== socket.id && p.connected === false
      && p.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  if (staleEntry) {
    const [oldId, oldParticipant] = staleEntry;
    if (room.participantGraceTimers?.[oldId]) {
      clearTimeout(room.participantGraceTimers[oldId]);
      delete room.participantGraceTimers[oldId];
    }
    delete room.participants[oldId];
    room.participants[socket.id] = { ...oldParticipant, id: socket.id };
    if (room.masterId === oldId) room.masterId = socket.id;
    console.log(`[reconnect] ${name} zit weer in room ${roomId} (stem/rol hersteld)`);
  }

  // Allow rejoin (e.g. page refresh) — only create entry if absent
  room.participants[socket.id] = room.participants[socket.id] || {
    id: socket.id, name, vote: null, hasVoted: false, isSpectator: Boolean(isSpectator),
  };
  room.participants[socket.id].name        = name;
  room.participants[socket.id].connected   = true;
  room.participants[socket.id].disconnectedAt = null;
  if (isSpectator !== undefined) {
    room.participants[socket.id].isSpectator = Boolean(isSpectator);
    if (room.participants[socket.id].isSpectator) {
      room.participants[socket.id].vote     = null;
      room.participants[socket.id].hasVoted = false;
    }
  }

  socket.join(roomId);

  const isMaster = room.masterId === socket.id;
  socket.emit('room-joined', { room: sanitizeRoom(room, socket.id), isMaster });
  broadcastRoomState(roomId);

  console.log(`[join] ${name} → ${roomId}`);
}

/** @param {import('socket.io').Socket} socket */
export function handleVote(socket, { roomId, vote }) {
  roomId = normalizeRoomId(roomId);
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

  room.participants[socket.id].isSpectator = false;
  room.participants[socket.id].vote     = voteStr;
  room.participants[socket.id].hasVoted = true;
  applyAutoReveal(room);
  broadcastRoomState(roomId);
}

/** @param {import('socket.io').Socket} socket */
export function handleToggleSpectator(socket, { roomId, isSpectator }) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !room.participants[socket.id]) return;

  const p = room.participants[socket.id];
  p.isSpectator = Boolean(isSpectator);
  if (p.isSpectator) {
    p.vote     = null;
    p.hasVoted = false;
    // The remaining voters may now all have voted
    applyAutoReveal(room);
  }
  broadcastRoomState(roomId);
}

/**
 * Handle claim master role (`claim-master`).
 * @param {import('socket.io').Socket} socket
 * @param {{ roomId: string }} payload
 */
export function handleClaimMaster(socket, { roomId } = {}) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || !room.participants[socket.id]) return;

  if (room.masterGraceTimer) {
    clearTimeout(room.masterGraceTimer);
    room.masterGraceTimer = null;
  }

  room.masterId = socket.id;
  room.masterName = room.participants[socket.id].name;
  socket.emit('became-master', {});
  broadcastRoomState(roomId);
  console.log(`[claim-master] ${room.masterName} claimed SM in room ${roomId}`);
}

/**
 * Handle transfer master role (`sm-transfer-master`).
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {{ roomId: string, targetId: string }} payload
 */
export function handleTransferMaster(io, socket, { roomId, targetId } = {}) {
  roomId = normalizeRoomId(roomId);
  const room = rooms[roomId];
  if (!room || room.masterId !== socket.id || !targetId || targetId === socket.id) return;
  if (!room.participants[targetId] || room.participants[targetId].connected === false) return;

  if (room.masterGraceTimer) {
    clearTimeout(room.masterGraceTimer);
    room.masterGraceTimer = null;
  }

  room.masterId = targetId;
  room.masterName = room.participants[targetId].name;
  io.to(targetId).emit('became-master', {});
  broadcastRoomState(roomId);
  console.log(`[transfer-master] SM transferred from ${socket.id} to ${targetId} in room ${roomId}`);
}
