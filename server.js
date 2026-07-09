/**
 * Scrum Poker Collab — Server entrypoint
 *
 * Verantwoordelijkheden:
 *   - Express app opstarten (static files, JSON body, API routes)
 *   - Socket.IO server initialiseren
 *   - HTTP server starten en IP loggen
 *
 * Alle andere logica zit in src/:
 *   src/config.js                        — poort, CORS, deck-definities
 *   src/store/rooms.js                   — in-memory rooms + sanitizeRoom
 *   src/utils/broadcast.js               — broadcastRoomState, scheduleRoomCleanup
 *   src/utils/roomId.js                  — generateRoomId
 *   src/routes/api.js                    — REST: /api/rooms/:id, /api/rooms/:id/qr
 *   src/socket/index.js                  — Socket.IO connection bootstrapper
 *   src/socket/handlers/roomHandlers.js  — create-room, join-room, vote
 *   src/socket/handlers/smHandlers.js    — reveal, reset, change-deck, update-name
 *   src/socket/handlers/connectionHandlers.js — kick-user, disconnect
 */

import express    from 'express';
import http       from 'http';
import { Server } from 'socket.io';
import path       from 'path';
import { fileURLToPath } from 'url';

import { PORT, PUBLIC_URL, CORS_ORIGIN } from './src/config.js';
import { initBroadcast }                 from './src/utils/broadcast.js';
import apiRouter                         from './src/routes/api.js';
import { initSocketHandlers }            from './src/socket/index.js';

// ─── Express ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const server    = http.createServer(app);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use('/api', apiRouter);

// Health check (delegates to apiRouter)
app.get('/health', (req, res, next) => { req.url = '/health'; apiRouter(req, res, next); });

// 404 catch-all
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    return res.status(404).json({ error: 'Route niet gevonden' });
  }
  res.redirect('/');
});

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
});

initBroadcast(io);
initSocketHandlers(io);

// ─── Start ───────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🃏  Scrum Poker Collab`);
  console.log(`    Lokaal :  http://localhost:${PORT}`);
  console.log(`    Netwerk:  ${PUBLIC_URL}`);
  console.log(`    (Tip: Stel PUBLIC_URL in via env-variabele voor reverse proxies of Docker bridge)\n`);
});
