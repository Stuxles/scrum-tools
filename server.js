/**
 * Scrum Poker — Server entrypoint
 *
 * Responsibilities:
 *   - Start Express app (static files, JSON body, API routes)
 *   - Initialize Socket.IO server
 *   - Start HTTP server and log IP addresses
 *
 * All other logic resides in src/:
 *   src/config.js                        — port, CORS, deck definitions
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

import { PORT, PUBLIC_URL, CORS_ORIGIN, APP_NAME, TRUST_PROXY } from './src/config.js';
import { initBroadcast }                 from './src/utils/broadcast.js';
import apiRouter                         from './src/routes/api.js';
import { initSocketHandlers }            from './src/socket/index.js';

// ─── Express ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const server    = http.createServer(app);

// Off by default; see TRUST_PROXY in src/config.js before enabling.
if (TRUST_PROXY) app.set('trust proxy', TRUST_PROXY);

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
  // Report `trust proxy` explicitly: it is off unless TRUST_PROXY is set, and
  // when it is off behind a reverse proxy every client presents as the proxy's
  // IP, so they all share one REST rate-limit bucket. That is invisible from
  // the outside — worth stating rather than leaving to be guessed.
  const proxyState = TRUST_PROXY
    ? `on (${TRUST_PROXY}) — req.ip comes from X-Forwarded-For`
    : 'off — req.ip is the direct connection (behind a proxy: the proxy IP)';

  console.log(`\n🃏  ${APP_NAME}`);
  console.log(`    Local  :  http://localhost:${PORT}`);
  console.log(`    Network:  ${PUBLIC_URL}`);
  console.log(`    Proxy  :  ${proxyState}`);
  console.log(`    (Tip: set PUBLIC_URL via an env variable for reverse proxies or a Docker bridge)\n`);
});
