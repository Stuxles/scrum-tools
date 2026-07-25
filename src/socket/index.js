/**
 * Socket.IO connection entry point.
 * Wires all event handlers and attaches the per-socket rate limiter.
 */

import { handleCreateRoom, handleJoinRoom, handleWatchRoom, handleVote, handleToggleSpectator, handleClaimMaster, handleTransferMaster } from './handlers/roomHandlers.js';
import { handleReveal, handleReset, handleChangeDeck, handleUpdateName, handleUpdateStoryTitle, handleToggleAutoReveal } from './handlers/smHandlers.js';
import { handleKickUser, handleDisconnect }              from './handlers/connectionHandlers.js';
import { info, warn, error as logError }                 from '../utils/logger.js';
import { SOCKET_RATE_LIMIT_MAX, SOCKET_RATE_LIMIT_WINDOW_MS } from '../config.js';

/** @param {import('socket.io').Server} io */
export function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    info('connect', socket.id);

    // ── Per-socket rate limiter ───────────────────────────────────────────────
    let eventCount = 0;
    let lastReset  = Date.now();

    socket.use((_packet, next) => {
      const now = Date.now();
      if (now - lastReset > SOCKET_RATE_LIMIT_WINDOW_MS) { eventCount = 0; lastReset = now; }
      if (++eventCount > SOCKET_RATE_LIMIT_MAX) {
        warn('rate-limit', `socket ${socket.id} exceeded ${SOCKET_RATE_LIMIT_MAX} events/${SOCKET_RATE_LIMIT_WINDOW_MS / 1000}s`);
        socket.emit('error', { message: 'Te veel acties achter elkaar. Wacht een seconde.' });
        return;
      }
      next();
    });

    // Safe dispatch: default a missing payload to {} and isolate handler
    // errors so one malformed message can never crash the process.
    const on = (event, handler) => {
      socket.on(event, (data = {}) => {
        try {
          handler(data || {});
        } catch (err) {
          logError(`handler:${event}`, socket.id, err);
          socket.emit('error', { message: 'Er ging iets mis. Probeer het opnieuw.' });
        }
      });
    };

    // ── Room events ──────────────────────────────────────────────────────────
    on('create-room',      (data) => handleCreateRoom(socket, data));
    on('join-room',        (data) => handleJoinRoom(io, socket, data));
    on('watch-room',       (data) => handleWatchRoom(socket, data));
    on('vote',             (data) => handleVote(socket, data));
    on('toggle-spectator', (data) => handleToggleSpectator(socket, data));
    on('claim-master',     (data) => handleClaimMaster(socket, data));

    // ── SM-only events ───────────────────────────────────────────────────────
    on('reveal',             (data) => handleReveal(socket, data));
    on('reset',              (data) => handleReset(socket, data));
    on('change-deck',        (data) => handleChangeDeck(socket, data));
    on('update-name',        (data) => handleUpdateName(socket, data));
    on('update-story-title', (data) => handleUpdateStoryTitle(socket, data));
    on('toggle-auto-reveal', (data) => handleToggleAutoReveal(socket, data));
    on('sm-transfer-master', (data) => handleTransferMaster(io, socket, data));

    // ── Admin / lifecycle ────────────────────────────────────────────────────
    on('kick-user',   (data) => handleKickUser(io, socket, data));
    socket.on('disconnect',  ()     => handleDisconnect(io, socket));
  });
}
