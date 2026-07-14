import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';

describe('Socket.IO Real-time End-to-End Tests', () => {
  let httpServer;
  let ioServer;
  let port;
  const activeClients = [];

  before(() => {
    return new Promise((resolve) => {
      httpServer = http.createServer();
      ioServer = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] }
      });
      initBroadcast(ioServer);
      initSocketHandlers(ioServer);

      httpServer.listen(0, '127.0.0.1', () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  after(() => {
    for (const c of activeClients) {
      c.disconnect();
    }
    for (const key of Object.keys(rooms)) {
      deleteRoom(key);
    }
    ioServer.close();
    httpServer.close();
  });

  beforeEach(() => {
    for (const c of activeClients) {
      if (c.connected) c.disconnect();
    }
    activeClients.length = 0;
    for (const key of Object.keys(rooms)) {
      deleteRoom(key);
    }
  });

  function createClient() {
    const client = ioc(`http://127.0.0.1:${port}`, {
      forceNew: true,
      transports: ['websocket', 'polling']
    });
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
    return new Promise((resolve) => {
      client.once(event, resolve);
    });
  }

  test('create-room should generate unique room ID and return room-created event', async () => {
    const client = createClient();
    await waitForConnect(client);

    client.emit('create-room', { name: 'Scrum Master Alice', deckType: 'fibonacci' });
    const { roomId } = await onceEvent(client, 'room-created');

    assert.ok(roomId, 'Room ID should be provided');
    assert.strictEqual(roomId.length, 6, 'Room ID should be 6 characters');
    assert.ok(rooms[roomId], 'Room must exist in store');
    assert.strictEqual(rooms[roomId].deckType, 'fibonacci');
  });

  test('join-room should add participant and emit room-joined plus room-state', async () => {
    const master = createClient();
    await waitForConnect(master);

    master.emit('create-room', { name: 'Master Alice', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');

    master.emit('join-room', { roomId, name: 'Master Alice' });
    const joinedData = await onceEvent(master, 'room-joined');

    assert.strictEqual(joinedData.isMaster, true);
    assert.strictEqual(joinedData.room.participants.length, 1);
    assert.strictEqual(joinedData.room.participants[0].name, 'Master Alice');
  });

  test('vote, reveal, and reset lifecycle between master and voter', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'fibonacci' });
    const { roomId } = await onceEvent(master, 'room-created');

    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');

    voter.emit('join-room', { roomId, name: 'Voter Bob' });
    const voterJoined = await onceEvent(voter, 'room-joined');
    assert.strictEqual(voterJoined.room.participants.length, 2);

    // Voter casts a vote
    voter.emit('vote', { roomId, vote: '8' });

    // Wait for room-state broadcast on master
    const stateAfterVote = await new Promise((resolve) => {
      const handler = ({ room }) => {
        const bob = room.participants.find(p => p.name === 'Voter Bob');
        if (bob && bob.hasVoted) {
          master.off('room-state', handler);
          resolve(room);
        }
      };
      master.on('room-state', handler);
    });

    const bobBeforeReveal = stateAfterVote.participants.find(p => p.name === 'Voter Bob');
    assert.strictEqual(bobBeforeReveal.hasVoted, true);
    assert.strictEqual(bobBeforeReveal.vote, null, 'Master should NOT see secret vote before reveal');

    // Now master reveals
    master.emit('reveal', { roomId });
    const stateAfterReveal = await new Promise((resolve) => {
      const handler = ({ room }) => {
        if (room.revealed === true) {
          master.off('room-state', handler);
          resolve(room);
        }
      };
      master.on('room-state', handler);
    });

    const bobAfterReveal = stateAfterReveal.participants.find(p => p.name === 'Voter Bob');
    assert.strictEqual(bobAfterReveal.vote, '8', 'Vote must be visible after reveal');

    // Master resets round
    master.emit('reset', { roomId });
    const stateAfterReset = await new Promise((resolve) => {
      const handler = ({ room }) => {
        if (room.revealed === false) {
          master.off('room-state', handler);
          resolve(room);
        }
      };
      master.on('room-state', handler);
    });

    const bobAfterReset = stateAfterReset.participants.find(p => p.name === 'Voter Bob');
    assert.strictEqual(bobAfterReset.hasVoted, false, 'hasVoted must be false after reset');
    assert.strictEqual(bobAfterReset.vote, null, 'Vote must be cleared after reset');
  });

  test('kick-user should disconnect target user and emit kicked event', async () => {
    const master = createClient();
    const target = createClient();
    await waitForConnect(master);
    await waitForConnect(target);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');

    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');

    target.emit('join-room', { roomId, name: 'Target User' });
    const targetJoined = await onceEvent(target, 'room-joined');
    const targetId = targetJoined.room.participants.find(p => p.name === 'Target User').id;

    // Listen for kicked on target
    const kickedPromise = onceEvent(target, 'kicked');

    // Master kicks user
    master.emit('kick-user', { roomId, targetId });

    await kickedPromise;
    assert.ok(true, 'Target user received kicked event');
  });

  test('update-story-title should broadcast new story title to all participants', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'tshirt' });
    const { roomId } = await onceEvent(master, 'room-created');

    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');

    voter.emit('join-room', { roomId, name: 'Voter Bob' });
    await onceEvent(voter, 'room-joined');

    master.emit('update-story-title', { roomId, storyTitle: 'Refactor Login API (#202)' });

    const updatedRoom = await new Promise((resolve) => {
      const handler = ({ room }) => {
        if (room.storyTitle === 'Refactor Login API (#202)') {
          voter.off('room-state', handler);
          resolve(room);
        }
      };
      voter.on('room-state', handler);
    });

    assert.strictEqual(updatedRoom.storyTitle, 'Refactor Login API (#202)');
  });
});
