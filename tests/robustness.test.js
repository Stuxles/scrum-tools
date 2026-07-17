import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';

describe('Socket robustness / malformed payload handling', () => {
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

  const EVENTS = [
    'create-room', 'join-room', 'vote', 'toggle-spectator', 'claim-master',
    'reveal', 'reset', 'change-deck', 'update-name', 'update-story-title',
    'sm-transfer-master', 'kick-user',
  ];

  test('emitting every event with no payload does not crash the server', async () => {
    const client = createClient();
    await waitForConnect(client);

    for (const event of EVENTS) {
      client.emit(event); // undefined payload
    }
    // Give the server a tick to process, then prove it is still alive.
    await new Promise(r => setTimeout(r, 100));

    const probe = createClient();
    await waitForConnect(probe);
    probe.emit('create-room', { name: 'Still Alive', deckType: 'standard' });
    const { roomId } = await onceEvent(probe, 'room-created');
    assert.ok(roomId, 'Server still handles create-room after malformed payloads');
  });

  test('emitting every event with null payload does not crash the server', async () => {
    const client = createClient();
    await waitForConnect(client);

    for (const event of EVENTS) {
      client.emit(event, null);
    }
    await new Promise(r => setTimeout(r, 100));

    const probe = createClient();
    await waitForConnect(probe);
    probe.emit('create-room', { name: 'Alive2', deckType: 'standard' });
    const { roomId } = await onceEvent(probe, 'room-created');
    assert.ok(roomId, 'Server survives null payloads');
  });

  test('prototype-chain roomIds resolve to no room and do not crash', async () => {
    const client = createClient();
    await waitForConnect(client);

    for (const roomId of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      client.emit('vote', { roomId, vote: '5' });
      client.emit('reveal', { roomId });
      client.emit('reset', { roomId });
    }
    await new Promise(r => setTimeout(r, 100));

    // No polluted keys should have leaked into the store.
    assert.strictEqual(Object.keys(rooms).length, 0, 'No room created from prototype keys');

    const probe = createClient();
    await waitForConnect(probe);
    probe.emit('create-room', { name: 'Alive3', deckType: 'standard' });
    const { roomId } = await onceEvent(probe, 'room-created');
    assert.ok(roomId, 'Server survives prototype-key lookups');
  });
});
