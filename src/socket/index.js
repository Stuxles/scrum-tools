/**
 * Socket.IO connection entry point.
 * Wires all event handlers and attaches the per-socket rate limiter.
 */

import { handleCreateRoom, handleJoinRoom, handleVote, handleToggleSpectator } from './handlers/roomHandlers.js';
import { handleReveal, handleReset, handleChangeDeck, handleUpdateName, handleUpdateStoryTitle } from './handlers/smHandlers.js';
import { handleKickUser, handleDisconnect }              from './handlers/connectionHandlers.js';

/** @param {import('socket.io').Server} io */
export function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[+] ${socket.id}`);

    // ── Per-socket rate limiter (max 35 events/sec) ──────────────────────────
    let eventCount = 0;
    let lastReset  = Date.now();

    socket.use((_packet, next) => {
      const now = Date.now();
      if (now - lastReset > 1000) { eventCount = 0; lastReset = now; }
      if (++eventCount > 35) {
        socket.emit('error', { message: 'Te veel acties achter elkaar. Wacht een seconde.' });
        return;
      }
      next();
    });

    // ── Room events ──────────────────────────────────────────────────────────
    socket.on('create-room',      (data) => handleCreateRoom(socket, data));
    socket.on('join-room',        (data) => handleJoinRoom(socket, data));
    socket.on('vote',             (data) => handleVote(socket, data));
    socket.on('toggle-spectator', (data) => handleToggleSpectator(socket, data));

    // ── SM-only events ───────────────────────────────────────────────────────
    socket.on('reveal',      (data) => handleReveal(socket, data));
    socket.on('reset',       (data) => handleReset(socket, data));
    socket.on('change-deck',        (data) => handleChangeDeck(socket, data));
    socket.on('update-name',        (data) => handleUpdateName(socket, data));
    socket.on('update-story-title', (data) => handleUpdateStoryTitle(socket, data));

    // ── Admin / lifecycle ────────────────────────────────────────────────────
    socket.on('kick-user',   (data) => handleKickUser(io, socket, data));
    socket.on('disconnect',  ()     => handleDisconnect(io, socket));
  });
}
