/**
 * Regression tests for the three bugs found in the September 2026 review.
 *
 * Each one is written as the scenario that reproduced it, so a future change
 * that reintroduces the behaviour fails here rather than in a planning session.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';
import { DECKS } from '../src/config.js';

describe('Regressions from the codebase review', () => {
  let httpServer;
  let ioServer;
  let port;
  const activeClients = [];

  before(() => new Promise((resolve) => {
    httpServer = http.createServer();
    ioServer = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
    initBroadcast(ioServer);
    initSocketHandlers(ioServer);
    httpServer.listen(0, '127.0.0.1', () => {
      port = httpServer.address().port;
      resolve();
    });
  }));

  after(() => {
    for (const c of activeClients) c.disconnect();
    for (const key of Object.keys(rooms)) deleteRoom(key);
    ioServer.close();
    httpServer.close();
  });

  beforeEach(() => {
    for (const c of activeClients) { if (c.connected) c.disconnect(); }
    activeClients.length = 0;
    for (const key of Object.keys(rooms)) deleteRoom(key);
  });

  function createClient() {
    const client = ioc(`http://127.0.0.1:${port}`, { forceNew: true, transports: ['websocket', 'polling'] });
    activeClients.push(client);
    return client;
  }

  const waitForConnect = (client) => new Promise((resolve, reject) => {
    if (client.connected) return resolve();
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });

  const onceEvent = (client, event) => new Promise((resolve) => client.once(event, resolve));

  /** Resolve once `predicate(room)` holds, or reject with a readable message. */
  function waitForRoomState(client, predicate, label, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        client.off('room-state', handler);
        reject(new Error(`timed out waiting for: ${label}`));
      }, timeoutMs);
      const handler = ({ room }) => {
        if (!predicate(room)) return;
        clearTimeout(timer);
        client.off('room-state', handler);
        resolve(room);
      };
      client.on('room-state', handler);
    });
  }

  async function joinedRoom(client, roomId, name, extra = {}) {
    client.emit('join-room', { roomId, name, ...extra });
    return onceEvent(client, 'room-joined');
  }

  // ── Bug 1 ──────────────────────────────────────────────────────────────────
  describe('card decks at room creation', () => {
    for (const [type, cards] of Object.entries(DECKS)) {
      test(`the "${type}" preset arrives intact`, async () => {
        const creator = createClient();
        await waitForConnect(creator);
        creator.emit('create-room', { deckType: type, roomName: `${type} room` });
        const { roomId } = await onceEvent(creator, 'room-created');

        const { room } = await joinedRoom(creator, roomId, 'Alice');
        assert.equal(room.deckType, type);
        assert.deepEqual(room.deck, cards);
      });
    }

    test('a custom deck survives creation instead of silently becoming the standard one', async () => {
      const creator = createClient();
      await waitForConnect(creator);
      creator.emit('create-room', { deckType: 'custom', customCards: ['1', '2', '4', '8'], roomName: 'Custom' });
      const { roomId } = await onceEvent(creator, 'room-created');

      const { room } = await joinedRoom(creator, roomId, 'Alice');
      assert.equal(room.deckType, 'custom');
      assert.deepEqual(room.deck, ['1', '2', '4', '8']);
    });

    test('an unknown deck type still falls back to the standard preset', async () => {
      const creator = createClient();
      await waitForConnect(creator);
      creator.emit('create-room', { deckType: 'tarot', roomName: 'Nonsense' });
      const { roomId } = await onceEvent(creator, 'room-created');

      const { room } = await joinedRoom(creator, roomId, 'Alice');
      assert.equal(room.deckType, 'standard');
      assert.deepEqual(room.deck, DECKS.standard);
    });

    test('a custom deck with fewer than two cards is refused, and no room is made', async () => {
      const creator = createClient();
      await waitForConnect(creator);
      const before = Object.keys(rooms).length;

      creator.emit('create-room', { deckType: 'custom', customCards: ['1'], roomName: 'Too small' });
      const err = await onceEvent(creator, 'error');

      assert.match(err.message, /minimaal 2 kaarten/i);
      assert.equal(Object.keys(rooms).length, before);
    });

    test('creation and change-deck agree on what a custom deck is', async () => {
      const creator = createClient();
      await waitForConnect(creator);
      creator.emit('create-room', { deckType: 'custom', customCards: ['S', 'M', 'L'], roomName: 'Agreement' });
      const { roomId } = await onceEvent(creator, 'room-created');
      const { room: created } = await joinedRoom(creator, roomId, 'Alice');

      creator.emit('change-deck', { roomId, deckType: 'custom', customCards: ['S', 'M', 'L'] });
      const changed = await waitForRoomState(creator, r => r.deckType === 'custom', 'change-deck applied');

      assert.deepEqual(created.deck, changed.deck);
    });
  });

  // ── Bug 2 ──────────────────────────────────────────────────────────────────
  describe('a participant who drops off does not stall the round', () => {
    test('auto-reveal fires once everyone still reachable has voted', async () => {
      const alice = createClient();
      const bob   = createClient();
      await Promise.all([waitForConnect(alice), waitForConnect(bob)]);

      alice.emit('create-room', { roomName: 'Auto' });
      const { roomId } = await onceEvent(alice, 'room-created');
      await joinedRoom(alice, roomId, 'Alice');
      await joinedRoom(bob, roomId, 'Bob');

      alice.emit('toggle-auto-reveal', { roomId, autoReveal: true });
      await waitForRoomState(alice, r => r.autoReveal === true, 'auto-reveal on');

      alice.emit('vote', { roomId, vote: '5' });
      await waitForRoomState(alice, r => r.participants.some(p => p.name === 'Alice' && p.hasVoted), 'Alice voted');

      // Bob's phone locks before he votes. His seat is kept, but the round
      // must not sit waiting on him for the whole grace window.
      const revealed = waitForRoomState(alice, r => r.revealed, 'reveal after Bob drops off');
      bob.disconnect();
      const room = await revealed;

      assert.equal(room.revealed, true);
      const bobRow = room.participants.find(p => p.name === 'Bob');
      assert.ok(bobRow, 'Bob keeps his seat for the grace window');
      assert.equal(bobRow.connected, false);
      assert.equal(bobRow.hasVoted, false);
    });

    test('someone who voted and then dropped off still counts, so the round is not cut short', async () => {
      const alice = createClient();
      const bob   = createClient();
      const carol = createClient();
      await Promise.all([waitForConnect(alice), waitForConnect(bob), waitForConnect(carol)]);

      alice.emit('create-room', { roomName: 'Voted then gone' });
      const { roomId } = await onceEvent(alice, 'room-created');
      await joinedRoom(alice, roomId, 'Alice');
      await joinedRoom(bob, roomId, 'Bob');
      await joinedRoom(carol, roomId, 'Carol');

      alice.emit('toggle-auto-reveal', { roomId, autoReveal: true });
      await waitForRoomState(alice, r => r.autoReveal === true, 'auto-reveal on');

      bob.emit('vote', { roomId, vote: '8' });
      await waitForRoomState(alice, r => r.participants.some(p => p.name === 'Bob' && p.hasVoted), 'Bob voted');

      bob.disconnect();
      await waitForRoomState(alice, r => r.participants.some(p => p.name === 'Bob' && p.connected === false), 'Bob away');

      // Carol has still not voted, so nothing may be revealed yet.
      assert.equal(rooms[roomId].revealed, false);

      alice.emit('vote', { roomId, vote: '8' });
      await waitForRoomState(alice, r => r.participants.some(p => p.name === 'Alice' && p.hasVoted), 'Alice voted');
      assert.equal(rooms[roomId].revealed, false, 'still waiting on Carol');

      const revealed = waitForRoomState(alice, r => r.revealed, 'reveal after Carol votes');
      carol.emit('vote', { roomId, vote: '8' });
      await revealed;

      // Bob's vote is part of the round even though he is offline.
      const votes = rooms[roomId].participants;
      assert.equal(Object.values(votes).filter(p => p.hasVoted).length, 3);
    });

    test('a room where everyone is offline reveals nothing', async () => {
      const alice = createClient();
      const bob   = createClient();
      await Promise.all([waitForConnect(alice), waitForConnect(bob)]);

      alice.emit('create-room', { roomName: 'All gone' });
      const { roomId } = await onceEvent(alice, 'room-created');
      await joinedRoom(alice, roomId, 'Alice');
      await joinedRoom(bob, roomId, 'Bob');

      alice.emit('toggle-auto-reveal', { roomId, autoReveal: true });
      await waitForRoomState(alice, r => r.autoReveal === true, 'auto-reveal on');

      alice.disconnect();
      bob.disconnect();
      await new Promise(r => setTimeout(r, 300));

      assert.equal(rooms[roomId].revealed, false, 'nobody voted, so there is nothing to reveal');
    });
  });

  // ── Bug 3 ──────────────────────────────────────────────────────────────────
  describe('kicking the host', () => {
    test('hands the role straight to someone still connected', async () => {
      const alice  = createClient();
      const bob    = createClient();
      const screen = createClient();
      await Promise.all([waitForConnect(alice), waitForConnect(bob), waitForConnect(screen)]);

      alice.emit('create-room', { roomName: 'Kick' });
      const { roomId } = await onceEvent(alice, 'room-created');
      const { isMaster } = await joinedRoom(alice, roomId, 'Alice');
      assert.equal(isMaster, true, 'first joiner is the host');
      await joinedRoom(bob, roomId, 'Bob');

      screen.emit('watch-room', { roomId });
      await onceEvent(screen, 'room-watched');

      const promoted = onceEvent(bob, 'became-master');
      screen.emit('kick-user', { roomId, targetId: rooms[roomId].masterId });
      await promoted;

      const room = rooms[roomId];
      assert.ok(room.participants[room.masterId], 'masterId points at a real participant');
      assert.equal(room.participants[room.masterId].name, 'Bob');
      assert.equal(room.masterToken, room.participants[room.masterId].sessionToken);
    });

    test('leaves no host behind when the kicked host was the last one there', async () => {
      const alice  = createClient();
      const screen = createClient();
      await Promise.all([waitForConnect(alice), waitForConnect(screen)]);

      alice.emit('create-room', { roomName: 'Solo' });
      const { roomId } = await onceEvent(alice, 'room-created');
      await joinedRoom(alice, roomId, 'Alice');

      screen.emit('watch-room', { roomId });
      await onceEvent(screen, 'room-watched');

      const kicked = onceEvent(alice, 'kicked');
      screen.emit('kick-user', { roomId, targetId: rooms[roomId].masterId });
      await kicked;
      await new Promise(r => setTimeout(r, 100));

      const room = rooms[roomId];
      assert.equal(room.masterId, null);
      assert.equal(room.masterToken, null);
      assert.equal(Object.keys(room.participants).length, 0);
    });

    test('a kicked host who rejoins does not get the role handed back', async () => {
      const alice  = createClient();
      const bob    = createClient();
      const screen = createClient();
      await Promise.all([waitForConnect(alice), waitForConnect(bob), waitForConnect(screen)]);

      alice.emit('create-room', { roomName: 'No takebacks' });
      const { roomId } = await onceEvent(alice, 'room-created');
      const first = await joinedRoom(alice, roomId, 'Alice');
      await joinedRoom(bob, roomId, 'Bob');

      screen.emit('watch-room', { roomId });
      await onceEvent(screen, 'room-watched');

      const promoted = onceEvent(bob, 'became-master');
      screen.emit('kick-user', { roomId, targetId: rooms[roomId].masterId });
      await promoted;

      // Alice comes back through the same link, replaying the token she holds.
      const rejoin = createClient();
      await waitForConnect(rejoin);
      const back = await joinedRoom(rejoin, roomId, 'Alice', { sessionToken: first.sessionToken });

      assert.equal(back.isMaster, false, 'the role stays with Bob');
      assert.equal(rooms[roomId].participants[rooms[roomId].masterId].name, 'Bob');
    });
  });
});
