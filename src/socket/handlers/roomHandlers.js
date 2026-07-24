import { rooms, sanitizeRoom } from '../../store/rooms.js';
import { DECKS }               from '../../config.js';
import { generateRoomId, normalizeRoomId } from '../../utils/roomId.js';
import {
  broadcastRoomState,
  scheduleRoomCleanup,
} from '../../utils/broadcast.js';
import { applyAutoReveal }     from '../../utils/autoReveal.js';
import { generateSessionToken, normalizeSessionToken } from '../../utils/sessionToken.js';
import { info }                from '../../utils/logger.js';

/**
 * Trim first, then fall back to the default — `('   ' || 'Anoniem').trim()`
 * picks the whitespace string *before* trimming it and yields '', leaving a
 * participant with a blank display name.
 *
 * @param {unknown} raw
 * @param {number}  maxLength
 * @param {string}  fallback
 * @returns {string}
 */
function cleanText(raw, maxLength, fallback) {
  return String(raw ?? '').trim().slice(0, maxLength) || fallback;
}

/** @param {import('socket.io').Socket} socket */
export function handleCreateRoom(socket, { name, deckType, customCards, roomName }) {
  name     = cleanText(name, 40, 'Anoniem');
  roomName = cleanText(roomName, 60, `${name}'s Room`);
  deckType = DECKS[deckType] ? deckType : 'standard';

  // Copy the preset — assigning DECKS[deckType] by reference would make every
  // room share one array, so a single in-place mutation anywhere would corrupt
  // the deck globally, for every room and every future room.
  const deck = deckType === 'custom'
    ? (customCards || []).map(s => String(s).trim().slice(0, 10)).filter(Boolean).slice(0, 30)
    : [...DECKS[deckType]];

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
    masterName:   name,   // display/logging only — never used to grant the role
    masterToken:  null,   // session token of the current SM; see utils/sessionToken.js
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
  info('room', `${roomId} aangemaakt door ${name}`);
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function handleJoinRoom(io, socket, { roomId, name, isSpectator, sessionToken }) {
  roomId = normalizeRoomId(roomId);
  name   = cleanText(name, 40, 'Anoniem');

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

  // TRUST MODEL: identity across reconnects is proven by a per-session
  // reconnect token (utils/sessionToken.js), never by the display name.
  // Names are user-chosen and non-unique — matching on them meant two
  // people called "Jan" were treated as one (the second joiner evicted the
  // first and inherited their vote), and anyone could take the Scrum Master
  // role simply by typing the SM's name. See docs/wiki/roles.md.
  //
  // A client with no (or an unrecognised) token is a brand new participant:
  // it never migrates a seat and never evicts anyone.
  const token = normalizeSessionToken(sessionToken);

  // Reconnect: a returning participant gets a NEW socket.id, so migrate
  // their old seat — vote, role, spectator state — to the new id instead of
  // losing it and starting fresh.
  //
  // Match regardless of `connected`, not just on already-away entries. A
  // flaky connection can have the client reconnect BEFORE the server's
  // ping-timeout notices the old socket died, so the old entry may still
  // read connected:true here. Gating on connected===false alone would miss
  // that race and leave two rows for the same person. The token guarantees
  // it really is the same person, so evicting the old socket is safe.
  const staleEntry = token
    ? Object.entries(room.participants).find(
        ([id, p]) => id !== socket.id && p.sessionToken === token,
      )
    : undefined;

  if (staleEntry) {
    const [oldId, oldParticipant] = staleEntry;
    if (oldParticipant.connected !== false) {
      // Old socket hasn't been marked away yet — evict it so it can't
      // coexist with the new connection holding the same token.
      const oldSocket = io.sockets.sockets.get(oldId);
      if (oldSocket) {
        oldSocket.emit('kicked', {});
        oldSocket.disconnect(true);
      }
    }
    if (room.participantGraceTimers?.[oldId]) {
      clearTimeout(room.participantGraceTimers[oldId]);
      delete room.participantGraceTimers[oldId];
    }
    delete room.participants[oldId];
    room.participants[socket.id] = { ...oldParticipant, id: socket.id };
    if (room.masterId === oldId) room.masterId = socket.id;
    info('reconnect', `${name} zit weer in room ${roomId} (stem/rol hersteld)`);
  }

  // Assign master, or hand the role back to the departed SM within the 30s
  // grace window — token match only.
  const reclaimsMaster = Boolean(token) && room.masterToken === token;
  const masterEntry    = room.masterId ? room.participants[room.masterId] : null;
  // No reachable SM: either the seat is gone entirely (grace expired, kicked)
  // or its owner is away with no grace timer left to bring them back.
  const masterAbsent   = !masterEntry || masterEntry.connected === false;

  if (room.masterGraceTimer && reclaimsMaster) {
    clearTimeout(room.masterGraceTimer);
    room.masterGraceTimer = null;
    room.masterId   = socket.id;
    room.masterName = name;
    info('master-grace', `${name} reclaimed SM by session token in room ${roomId}`);
  } else if (!room.masterId || (masterAbsent && !room.masterGraceTimer)) {
    room.masterId    = socket.id;
    room.masterName  = name;
    room.masterToken = token; // finalised below once the token is minted
  }

  // Allow rejoin (e.g. page refresh) — only create entry if absent
  room.participants[socket.id] = room.participants[socket.id] || {
    id: socket.id, name, vote: null, hasVoted: false, isSpectator: Boolean(isSpectator),
  };
  room.participants[socket.id].name        = name;
  room.participants[socket.id].connected   = true;
  room.participants[socket.id].disconnectedAt = null;

  // Reuse the token the client proved it already holds; otherwise mint one.
  // Kept off `sanitizeRoom` output — it goes to this one client only.
  const mySessionToken = room.participants[socket.id].sessionToken || token || generateSessionToken();
  room.participants[socket.id].sessionToken = mySessionToken;
  if (room.masterId === socket.id) room.masterToken = mySessionToken;

  if (isSpectator !== undefined) {
    room.participants[socket.id].isSpectator = Boolean(isSpectator);
    if (room.participants[socket.id].isSpectator) {
      room.participants[socket.id].vote     = null;
      room.participants[socket.id].hasVoted = false;
    }
  }

  socket.join(roomId);

  const isMaster = room.masterId === socket.id;
  socket.emit('room-joined', { room: sanitizeRoom(room, socket.id), isMaster, sessionToken: mySessionToken });
  broadcastRoomState(roomId);

  info('join', `${name} → ${roomId}`);
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

  room.masterId    = socket.id;
  room.masterName  = room.participants[socket.id].name;
  room.masterToken = room.participants[socket.id].sessionToken || null;
  socket.emit('became-master', {});
  broadcastRoomState(roomId);
  info('claim-master', `${room.masterName} claimed SM in room ${roomId}`);
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

  room.masterId    = targetId;
  room.masterName  = room.participants[targetId].name;
  room.masterToken = room.participants[targetId].sessionToken || null;
  io.to(targetId).emit('became-master', {});
  broadcastRoomState(roomId);
  info('transfer-master', `SM transferred from ${socket.id} to ${targetId} in room ${roomId}`);
}
