import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { expireParticipantGrace } from '../src/socket/handlers/connectionHandlers.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';

describe('Personal reconnect grace (disconnected participants keep their seat)', () => {
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

  function waitForRoomState(client, predicate) {
    return new Promise((resolve) => {
      const handler = ({ room }) => {
        if (predicate(room)) { client.off('room-state', handler); resolve(room); }
      };
      client.on('room-state', handler);
    });
  }

  test('disconnecting keeps the participant listed as away, with their vote intact server-side', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    voter.emit('vote', { roomId, vote: '8' });
    await waitForRoomState(master, (room) => {
      const bob = room.participants.find(p => p.name === 'Bob');
      return bob && bob.hasVoted;
    });

    const bobId = voter.id;
    const gonePromise = waitForRoomState(master, (room) => {
      const bob = room.participants.find(p => p.name === 'Bob');
      return bob && bob.connected === false;
    });
    voter.disconnect();
    const stateAfterDisconnect = await gonePromise;

    const bobSanitized = stateAfterDisconnect.participants.find(p => p.name === 'Bob');
    assert.ok(bobSanitized, 'Bob must still be listed after disconnecting');
    assert.strictEqual(bobSanitized.connected, false, 'Bob must be marked as away');

    // Server-side truth: the actual vote value survives, not just hasVoted.
    const bobStored = rooms[roomId].participants[bobId];
    assert.strictEqual(bobStored.connected, false);
    assert.strictEqual(bobStored.vote, '8', 'vote must be preserved while away, not cleared');
    assert.strictEqual(bobStored.hasVoted, true);
  });

  test('reconnecting with the same name restores the seat and vote under the new socket id', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    voter.emit('vote', { roomId, vote: '5' });
    await waitForRoomState(master, (room) => {
      const bob = room.participants.find(p => p.name === 'Bob');
      return bob && bob.hasVoted;
    });

    const oldBobId = voter.id;
    voter.disconnect();
    await new Promise(r => setTimeout(r, 150)); // let the server process the disconnect

    assert.strictEqual(rooms[roomId].participants[oldBobId]?.connected, false);

    // A fresh connection rejoins with the SAME display name.
    const reconnectedBob = createClient();
    await waitForConnect(reconnectedBob);
    reconnectedBob.emit('join-room', { roomId, name: 'Bob' });
    const joined = await onceEvent(reconnectedBob, 'room-joined');

    assert.strictEqual(rooms[roomId].participants[oldBobId], undefined, 'old ghost entry must be gone');
    const restored = rooms[roomId].participants[reconnectedBob.id];
    assert.ok(restored, 'new socket id must have the restored entry');
    assert.strictEqual(restored.vote, '5', 'vote restored on reconnect');
    assert.strictEqual(restored.hasVoted, true);
    assert.strictEqual(restored.connected, true);

    const bobInJoined = joined.room.participants.find(p => p.name === 'Bob');
    assert.strictEqual(bobInJoined.connected, true);
  });

  test('expireParticipantGrace removes a still-away participant but leaves a reconnected one alone', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    const bobId = voter.id;

    // Simulate "still away" and expire directly (no need to wait out the real 10-minute timer).
    rooms[roomId].participants[bobId].connected = false;
    expireParticipantGrace(roomId, bobId);
    assert.strictEqual(rooms[roomId].participants[bobId], undefined, 'away participant is removed on expiry');

    // A participant who reconnected (connected: true) must NOT be removed by a stale expiry call.
    voter.emit('join-room', { roomId, name: 'Bob' }); // rejoin as a fresh participant
    await onceEvent(voter, 'room-joined');
    const newBobId = voter.id;
    expireParticipantGrace(roomId, newBobId);
    assert.ok(rooms[roomId].participants[newBobId], 'connected participant must survive an expiry call');
  });

  test('the Scrum Master can kick an away participant immediately, bypassing the grace window', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    const bobId = voter.id;
    voter.disconnect();
    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(rooms[roomId].participants[bobId]?.connected, false);

    master.emit('kick-user', { roomId, targetId: bobId });
    await new Promise(r => setTimeout(r, 150));

    assert.strictEqual(rooms[roomId].participants[bobId], undefined, 'kick removes an away participant immediately');
  });

  test('transferring master to an away participant is rejected', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    const bobId = voter.id;
    voter.disconnect();
    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(rooms[roomId].participants[bobId]?.connected, false);

    master.emit('sm-transfer-master', { roomId, targetId: bobId });
    await new Promise(r => setTimeout(r, 150));

    assert.strictEqual(rooms[roomId].masterId, master.id, 'master role must not transfer to an away participant');
  });
});
