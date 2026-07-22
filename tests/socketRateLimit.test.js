import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';

describe('Per-socket rate limiter (max 35 events/sec)', () => {
  let httpServer;
  let ioServer;
  let port;
  const activeClients = [];

  before(() => {
    return new Promise((resolve) => {
      httpServer = http.createServer();
      ioServer = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
      initBroadcast(ioServer);
      initSocketHandlers(ioServer);
      httpServer.listen(0, '127.0.0.1', () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

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

  function waitForConnect(client) {
    return new Promise((resolve, reject) => {
      if (client.connected) return resolve();
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
  }

  function onceEvent(client, event) {
    return new Promise((resolve) => client.once(event, resolve));
  }

  test('spamming past 35 events/sec blocks the excess and warns the client, room stays intact', async () => {
    const client = createClient();
    await waitForConnect(client);

    client.emit('create-room', { name: 'Spammer', deckType: 'standard' });
    const { roomId } = await onceEvent(client, 'room-created');
    client.emit('join-room', { roomId, name: 'Spammer' });
    await onceEvent(client, 'room-joined');

    // Let the 1s window reset cleanly after create-room + join-room.
    await new Promise(r => setTimeout(r, 1100));

    const errors = [];
    client.on('error', (e) => errors.push(e));

    // Fire 40 vote events in one burst: 35 should pass, 5 should be blocked.
    for (let i = 0; i < 40; i++) {
      client.emit('vote', { roomId, vote: '5' });
    }

    await new Promise(r => setTimeout(r, 200));

    assert.strictEqual(errors.length, 5, 'exactly the 5 over-budget events should be rejected');
    assert.ok(
      errors.every(e => /Te veel acties/.test(e.message)),
      'rejected events must carry the rate-limit message',
    );

    // Socket must still be alive and the room untouched by the spam.
    assert.strictEqual(client.connected, true, 'spamming must not disconnect the socket');
    assert.ok(rooms[roomId], 'room must still exist after the burst');
    assert.strictEqual(Object.keys(rooms[roomId].participants).length, 1, 'no duplicate/corrupted participants');
    assert.strictEqual(rooms[roomId].participants[client.id].vote, '5', 'the vote that got through was applied');
  });

  test('after the 1s window elapses, the client can act normally again', async () => {
    const client = createClient();
    await waitForConnect(client);

    client.emit('create-room', { name: 'Spammer2', deckType: 'standard' });
    const { roomId } = await onceEvent(client, 'room-created');
    client.emit('join-room', { roomId, name: 'Spammer2' });
    await onceEvent(client, 'room-joined');
    await new Promise(r => setTimeout(r, 1100));

    // Exhaust the budget.
    for (let i = 0; i < 40; i++) client.emit('vote', { roomId, vote: '5' });
    await new Promise(r => setTimeout(r, 1100)); // wait for window reset

    // A normal follow-up action must succeed post-reset.
    client.emit('vote', { roomId, vote: '8' });
    const state = await new Promise((resolve) => {
      const handler = ({ room }) => {
        const me = room.participants.find(p => p.id === client.id);
        if (me && me.vote === '8') { client.off('room-state', handler); resolve(room); }
      };
      client.on('room-state', handler);
    });

    const me = state.participants.find(p => p.id === client.id);
    assert.strictEqual(me.vote, '8', 'client can vote normally again once the window resets');
  });

  test('one spamming client does not affect a different client in the same room', async () => {
    const spammer = createClient();
    const victim = createClient();
    await waitForConnect(spammer);
    await waitForConnect(victim);

    spammer.emit('create-room', { name: 'Spammer3', deckType: 'standard' });
    const { roomId } = await onceEvent(spammer, 'room-created');
    spammer.emit('join-room', { roomId, name: 'Spammer3' });
    await onceEvent(spammer, 'room-joined');

    victim.emit('join-room', { roomId, name: 'Victim' });
    await onceEvent(victim, 'room-joined');
    await new Promise(r => setTimeout(r, 1100));

    for (let i = 0; i < 60; i++) spammer.emit('vote', { roomId, vote: '5' });

    // Victim's own action is on its own budget and must go through immediately.
    // '12' is a valid standard-deck card (unlike '13', which is fibonacci-only).
    victim.emit('vote', { roomId, vote: '12' });
    const state = await new Promise((resolve) => {
      const handler = ({ room }) => {
        const v = room.participants.find(p => p.name === 'Victim');
        if (v && v.vote === '12') { victim.off('room-state', handler); resolve(room); }
      };
      victim.on('room-state', handler);
    });

    const victimP = state.participants.find(p => p.name === 'Victim');
    assert.strictEqual(victimP.vote, '12', 'other participants are unaffected by one client spamming');
  });
});
