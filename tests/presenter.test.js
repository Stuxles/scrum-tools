import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast, closeRoom } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';

describe('Presenter screens (displays are not participants)', () => {
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

  function waitForRoomState(client, predicate) {
    return new Promise((resolve) => {
      const handler = ({ room }) => {
        if (!predicate(room)) return;
        client.off('room-state', handler);
        resolve(room);
      };
      client.on('room-state', handler);
    });
  }

  /** Create a room (no display name) and return its id. */
  async function makeRoom(client, roomName = 'Test room') {
    client.emit('create-room', { deckType: 'standard', roomName });
    const { roomId } = await onceEvent(client, 'room-created');
    return roomId;
  }

  test('create-room needs no display name and falls back to a room-code name', async () => {
    const creator = createClient();
    await waitForConnect(creator);

    creator.emit('create-room', { deckType: 'standard' });
    const { roomId } = await onceEvent(creator, 'room-created');

    assert.strictEqual(rooms[roomId].name, `Room ${roomId}`);
    assert.strictEqual(rooms[roomId].masterId, null, 'a fresh room has no host yet');
    assert.strictEqual(rooms[roomId].masterName, '');
    assert.strictEqual(Object.keys(rooms[roomId].participants).length, 0, 'creating does not seat anyone');
  });

  test('watch-room attaches a display without creating a participant', async () => {
    const creator = createClient();
    await waitForConnect(creator);
    const roomId = await makeRoom(creator);

    const screen = createClient();
    await waitForConnect(screen);
    screen.emit('watch-room', { roomId });
    const watched = await onceEvent(screen, 'room-watched');

    assert.strictEqual(watched.room.id, roomId);
    assert.strictEqual(Object.keys(rooms[roomId].participants).length, 0, 'a screen is not a participant');
    assert.ok(rooms[roomId].displays.has(screen.id), 'screen is tracked as a display');
  });

  test('watch-room on a room that does not exist reports an error', async () => {
    const screen = createClient();
    await waitForConnect(screen);
    screen.emit('watch-room', { roomId: 'NOPE12' });
    const err = await onceEvent(screen, 'error');
    assert.match(err.message, /niet gevonden/);
  });

  test('the first participant to join becomes host, not the creator', async () => {
    const creator = createClient();
    await waitForConnect(creator);
    const roomId = await makeRoom(creator);

    const screen = createClient();
    await waitForConnect(screen);
    screen.emit('watch-room', { roomId });
    await onceEvent(screen, 'room-watched');

    const alice = createClient();
    await waitForConnect(alice);
    alice.emit('join-room', { roomId, name: 'Alice' });
    const joined = await onceEvent(alice, 'room-joined');

    assert.strictEqual(joined.isMaster, true, 'first joiner picks up the vacant host role');
    assert.strictEqual(rooms[roomId].masterId, alice.id);
  });

  test('a display sees no votes before the reveal and every vote after it', async () => {
    const creator = createClient();
    await waitForConnect(creator);
    const roomId = await makeRoom(creator);

    const screen = createClient();
    await waitForConnect(screen);
    screen.emit('watch-room', { roomId });
    await onceEvent(screen, 'room-watched');

    const alice = createClient();
    await waitForConnect(alice);
    alice.emit('join-room', { roomId, name: 'Alice' });
    await onceEvent(alice, 'room-joined');

    const votedOnScreen = waitForRoomState(screen, (r) => r.participants.some(p => p.hasVoted));
    alice.emit('vote', { roomId, vote: '5' });
    const hidden = await votedOnScreen;

    const aliceHidden = hidden.participants.find(p => p.name === 'Alice');
    assert.strictEqual(aliceHidden.hasVoted, true, 'the screen shows that she voted');
    assert.strictEqual(aliceHidden.vote, null, 'but not what she voted');

    const revealedOnScreen = waitForRoomState(screen, (r) => r.revealed);
    alice.emit('reveal', { roomId });
    const shown = await revealedOnScreen;

    assert.strictEqual(shown.participants.find(p => p.name === 'Alice').vote, '5');
  });

  test('two presenter screens on one room both receive state', async () => {
    const creator = createClient();
    await waitForConnect(creator);
    const roomId = await makeRoom(creator);

    const screenA = createClient();
    const screenB = createClient();
    await waitForConnect(screenA);
    await waitForConnect(screenB);
    screenA.emit('watch-room', { roomId });
    await onceEvent(screenA, 'room-watched');
    screenB.emit('watch-room', { roomId });
    await onceEvent(screenB, 'room-watched');

    assert.strictEqual(rooms[roomId].displays.size, 2);

    const onA = waitForRoomState(screenA, (r) => r.participants.length === 1);
    const onB = waitForRoomState(screenB, (r) => r.participants.length === 1);

    const alice = createClient();
    await waitForConnect(alice);
    alice.emit('join-room', { roomId, name: 'Alice' });

    await Promise.all([onA, onB]);
  });

  test('a watching screen keeps the room alive after the last participant leaves', async () => {
    const creator = createClient();
    await waitForConnect(creator);
    const roomId = await makeRoom(creator);

    const screen = createClient();
    await waitForConnect(screen);
    screen.emit('watch-room', { roomId });
    await onceEvent(screen, 'room-watched');

    const alice = createClient();
    await waitForConnect(alice);
    alice.emit('join-room', { roomId, name: 'Alice' });
    await onceEvent(alice, 'room-joined');

    alice.disconnect();
    await new Promise(r => setTimeout(r, 150));

    assert.ok(rooms[roomId], 'room still exists');
    assert.strictEqual(rooms[roomId].disconnectTimer, undefined,
      'no deletion countdown while a presenter screen is attached');

    screen.disconnect();
    await new Promise(r => setTimeout(r, 150));

    assert.ok(rooms[roomId].disconnectTimer, 'countdown starts once the last screen closes too');
  });

  test('closing a room tells the screens still watching', async () => {
    const creator = createClient();
    await waitForConnect(creator);
    const roomId = await makeRoom(creator);

    const screen = createClient();
    await waitForConnect(screen);
    screen.emit('watch-room', { roomId });
    await onceEvent(screen, 'room-watched');

    const closed = onceEvent(screen, 'room-closed');
    closeRoom(roomId);
    const payload = await closed;

    assert.strictEqual(payload.roomId, roomId);
    assert.strictEqual(rooms[roomId], undefined, 'room is gone');
  });

  test('switching a seated participant to presenter mode drops their seat', async () => {
    const creator = createClient();
    await waitForConnect(creator);
    const roomId = await makeRoom(creator);

    const alice = createClient();
    await waitForConnect(alice);
    alice.emit('join-room', { roomId, name: 'Alice' });
    const joined = await onceEvent(alice, 'room-joined');
    assert.strictEqual(joined.isMaster, true);

    // Same person reopens the room as a presenter screen, replaying the token
    // their browser stored — the seat should not linger as a ghost row.
    const screen = createClient();
    await waitForConnect(screen);
    screen.emit('watch-room', { roomId, sessionToken: joined.sessionToken });
    await onceEvent(screen, 'room-watched');

    assert.strictEqual(Object.keys(rooms[roomId].participants).length, 0, 'old seat removed');
    assert.strictEqual(rooms[roomId].masterId, null, 'and the vacated host role is released');
  });
});
