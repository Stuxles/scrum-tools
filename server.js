'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const CORS_ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
const io = new Server(server, { cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] } });

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || detectLocalIP()).replace(/\/$/, '');

function detectLocalIP() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(ifaces)) {
    const lower = name.toLowerCase();
    const isVirtual = lower.includes('docker') || lower.includes('veth') || lower.includes('br-') || lower.includes('vmnet') || lower.includes('vbox') || lower.includes('hyper-v') || lower.includes('tailscale');
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) return `http://${iface.address}:${PORT}`;
        candidates.push(`http://${iface.address}:${PORT}`);
      }
    }
  }
  return candidates.length > 0 ? candidates[0] : `http://localhost:${PORT}`;
}

// ─── Deck Definitions ────────────────────────────────────────────────────────
const DECKS = {
  standard:  ['0','1','2','3','4','5','6','8','12','16','24','32','40','♾️','❓','☕'],
  fibonacci: ['0','1','2','3','5','8','13','21','34','55','89','❓','☕'],
  tshirt:    ['XS','S','M','L','XL','XXL','❓','☕'],
};

// ─── In-Memory Store ─────────────────────────────────────────────────────────
/** @type {Record<string, Room>} */
const rooms = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateRoomId() {
  // 6-char alphanumeric, uppercase
  return uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
}

/**
 * Serialize room state for clients.
 * Votes are hidden unless the room is revealed.
 */
function sanitizeRoom(room, viewerSocketId = null) {
  return {
    id:          room.id,
    name:        room.name,
    masterId:    room.masterId,
    deckType:    room.deckType,
    deck:        room.deck,
    revealed:    room.revealed,
    participants: Object.values(room.participants).map(p => ({
      id:       p.id,
      name:     p.name,
      hasVoted: p.hasVoted,
      vote:     (room.revealed || (viewerSocketId && p.id === viewerSocketId)) ? p.vote : null,
      isMaster: p.id === room.masterId,
    })),
  };
}

function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  for (const p of Object.values(room.participants)) {
    const socket = io.sockets.sockets.get(p.id);
    if (socket) {
      socket.emit('room-state', { room: sanitizeRoom(room, p.id) });
    }
  }
}

function scheduleRoomCleanup(roomId) {
  setTimeout(() => {
    if (rooms[roomId]) {
      delete rooms[roomId];
      console.log(`[cleanup] Room ${roomId} verwijderd na 24u.`);
    }
  }, 24 * 60 * 60 * 1000);
}

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── REST API ─────────────────────────────────────────────────────────────────
app.get('/api/rooms/:id', (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room niet gevonden' });
  res.json({ exists: true, name: room.name });
});

app.get('/api/rooms/:id/qr', async (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room niet gevonden' });

  // Dynamisch de baseUrl bepalen uit de frontend query, reverse proxy headers, of fallback op PUBLIC_URL
  const baseUrl = req.query.baseUrl
    || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host || PUBLIC_URL}`;
  
  const url = `${baseUrl.replace(/\/$/, '')}/room.html?id=${room.id}`;
  const theme = req.query.theme || 'dark';
  const color = theme === 'light'
    ? { dark: '#0f172a', light: '#ffffff' }
    : { dark: '#a78bfa', light: '#0d0d1a' };

  try {
    const qr = await QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color,
    });
    res.json({ qr, url });
  } catch (err) {
    res.status(500).json({ error: 'QR generatie mislukt' });
  }
});

// Health check (useful for Docker)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── 404 Catch-All ────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    return res.status(404).json({ error: 'Route niet gevonden' });
  }
  res.redirect('/');
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  // Rate limiter per socket connection (max 35 events/sec)
  let eventCount = 0;
  let lastReset = Date.now();
  socket.use((packet, next) => {
    const now = Date.now();
    if (now - lastReset > 1000) {
      eventCount = 0;
      lastReset = now;
    }
    if (++eventCount > 35) {
      socket.emit('error', { message: 'Te veel acties achter elkaar. Wacht een seconde.' });
      return; // Drop packet
    }
    next();
  });

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on('create-room', ({ name, deckType, customCards, roomName }) => {
    name     = (name     || 'Anoniem').trim().slice(0, 40);
    roomName = (roomName || `${name}'s Room`).trim().slice(0, 60);
    deckType = DECKS[deckType] ? deckType : 'standard';

    const deck = deckType === 'custom'
      ? (customCards || []).map(s => String(s).trim()).filter(Boolean).slice(0, 30)
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
      id: roomId,
      name: roomName,
      // masterId is set when the SM joins from room.html
      // We store masterName to identify the SM when they rejoin
      masterId: null,
      masterName: name,
      deckType,
      deck,
      revealed: false,
      participants: {},
      createdAt: Date.now(),
    };

    scheduleRoomCleanup(roomId);

    socket.emit('room-created', { roomId });
    console.log(`[room] ${roomId} aangemaakt door ${name}`);
  });

  // ── Join Room ────────────────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, name }) => {
    roomId = (roomId || '').trim().toUpperCase();
    name   = (name   || 'Anoniem').trim().slice(0, 40);

    const room = rooms[roomId];
    if (!room) {
      socket.emit('error', { message: `Room "${roomId}" niet gevonden. Controleer de code.` });
      return;
    }

    if (room.disconnectTimer) {
      clearTimeout(room.disconnectTimer);
      delete room.disconnectTimer;
    }

    // If room has no master yet, OR if their name matches masterName (the creator rejoining after refresh/disconnect)
    if (!room.masterId || (room.masterName && name.toLowerCase() === room.masterName.toLowerCase()) || !room.participants[room.masterId]) {
      room.masterId = socket.id;
      room.masterName = name;
    }

    // Allow rejoin (e.g. page refresh)
    room.participants[socket.id] = room.participants[socket.id] || {
      id: socket.id, name, vote: null, hasVoted: false,
    };
    // Always update name on join
    room.participants[socket.id].name = name;

    socket.join(roomId);

    const isMaster = room.masterId === socket.id;
    socket.emit('room-joined', { room: sanitizeRoom(room, socket.id), isMaster });
    broadcastRoomState(roomId);

    console.log(`[join] ${name} → ${roomId}`);
  });

  // ── Vote ─────────────────────────────────────────────────────────────────
  socket.on('vote', ({ roomId, vote }) => {
    const room = rooms[roomId];
    if (!room || !room.participants[socket.id]) return;
    if (room.revealed) return;

    room.participants[socket.id].vote     = String(vote);
    room.participants[socket.id].hasVoted = true;

    broadcastRoomState(roomId);
  });

  // ── Reveal (SM only) ─────────────────────────────────────────────────────
  socket.on('reveal', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.masterId !== socket.id) return;

    room.revealed = true;
    broadcastRoomState(roomId);
  });

  // ── Reset (SM only) ──────────────────────────────────────────────────────
  socket.on('reset', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.masterId !== socket.id) return;

    room.revealed = false;
    for (const p of Object.values(room.participants)) {
      p.vote     = null;
      p.hasVoted = false;
    }

    broadcastRoomState(roomId);
  });

  // ── Change Deck (SM only) ────────────────────────────────────────────────
  socket.on('change-deck', ({ roomId, deckType, customCards }) => {
    const room = rooms[roomId];
    if (!room || room.masterId !== socket.id) return;

    if (deckType === 'custom') {
      const cards = (customCards || []).map(s => String(s).trim()).filter(Boolean);
      if (cards.length < 2) {
        socket.emit('error', { message: 'Voer minimaal 2 kaarten in.' });
        return;
      }
      room.deck = cards;
    } else if (DECKS[deckType]) {
      room.deck = DECKS[deckType];
    } else return;

    room.deckType = deckType;
    room.revealed = false;
    for (const p of Object.values(room.participants)) { p.vote = null; p.hasVoted = false; }

    broadcastRoomState(roomId);
  });

  // ── Update Name ──────────────────────────────────────────────────────────
  socket.on('update-name', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room || !room.participants[socket.id]) return;

    name = (name || '').trim().slice(0, 40);
    if (!name) return;

    // Als de gebruiker die zijn naam aanpast de SM is, update dan ook masterName
    if (room.masterId === socket.id) {
      room.masterName = name;
    }

    room.participants[socket.id].name = name;
    broadcastRoomState(roomId);
  });

  // ── Kick User (SM only) ──────────────────────────────────────────────────
  socket.on('kick-user', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || room.masterId !== socket.id || targetId === socket.id) return;

    const target = io.sockets.sockets.get(targetId);
    if (target) { target.emit('kicked', {}); target.leave(roomId); }
    delete room.participants[targetId];

    broadcastRoomState(roomId);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);

    for (const [roomId, room] of Object.entries(rooms)) {
      if (!room.participants[socket.id]) continue;

      const wasMaster = room.masterId === socket.id;
      delete room.participants[socket.id];

      const remaining = Object.keys(room.participants);
      if (remaining.length === 0) {
        room.disconnectTimer = setTimeout(() => {
          if (rooms[roomId] && Object.keys(rooms[roomId].participants).length === 0) {
            delete rooms[roomId];
            console.log(`[cleanup] Room ${roomId} verwijderd na leegloop.`);
          }
        }, 15000);
        continue;
      }

      if (wasMaster) {
        room.masterId = remaining[0];
        io.to(remaining[0]).emit('became-master', {});
      }

      broadcastRoomState(roomId);
    }
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🃏  Scrum Poker Collab`);
  console.log(`    Lokaal :  http://localhost:${PORT}`);
  console.log(`    Netwerk:  ${PUBLIC_URL}`);
  console.log(`    (Tip: Stel PUBLIC_URL in via env-variabele voor reverse proxies of Docker bridge)\n`);
});
