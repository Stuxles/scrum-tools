import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { expireParticipantGrace, runMasterHandover } from '../src/socket/handlers/connectionHandlers.js';
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

  test('a card revealed before disconnect stays visible to others while the voter is away', async () => {
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

    voter.emit('vote', { roomId, vote: '12' });
    await waitForRoomState(master, (room) => {
      const bob = room.participants.find(p => p.name === 'Bob');
      return bob && bob.hasVoted;
    });

    master.emit('reveal', { roomId });
    await waitForRoomState(master, (room) => room.revealed === true);

    // Bob goes away AFTER the reveal.
    const awayPromise = waitForRoomState(master, (room) => {
      const bob = room.participants.find(p => p.name === 'Bob');
      return bob && bob.connected === false;
    });
    voter.disconnect();
    const stateWhileAway = await awayPromise;

    const bob = stateWhileAway.participants.find(p => p.name === 'Bob');
    assert.strictEqual(bob.connected, false, 'Bob is marked away');
    assert.strictEqual(stateWhileAway.revealed, true, 'room stays revealed');
    assert.strictEqual(bob.vote, '12', "Bob's revealed card must stay visible to other viewers while he is away");
    assert.strictEqual(bob.hasVoted, true);
  });

  test('reconnecting with the same session token restores the seat and vote under the new socket id', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    const bobJoined = await onceEvent(voter, 'room-joined');
    assert.match(bobJoined.sessionToken, /^[0-9a-f]{32}$/, 'server hands out a reconnect token on join');

    voter.emit('vote', { roomId, vote: '5' });
    await waitForRoomState(master, (room) => {
      const bob = room.participants.find(p => p.name === 'Bob');
      return bob && bob.hasVoted;
    });

    const oldBobId = voter.id;
    voter.disconnect();
    await new Promise(r => setTimeout(r, 150)); // let the server process the disconnect

    assert.strictEqual(rooms[roomId].participants[oldBobId]?.connected, false);

    // A fresh connection rejoins replaying the SAME session token.
    const reconnectedBob = createClient();
    await waitForConnect(reconnectedBob);
    reconnectedBob.emit('join-room', { roomId, name: 'Bob', sessionToken: bobJoined.sessionToken });
    const joined = await onceEvent(reconnectedBob, 'room-joined');

    assert.strictEqual(joined.sessionToken, bobJoined.sessionToken, 'the same token is handed back, not a new one');

    assert.strictEqual(rooms[roomId].participants[oldBobId], undefined, 'old ghost entry must be gone');
    const restored = rooms[roomId].participants[reconnectedBob.id];
    assert.ok(restored, 'new socket id must have the restored entry');
    assert.strictEqual(restored.vote, '5', 'vote restored on reconnect');
    assert.strictEqual(restored.hasVoted, true);
    assert.strictEqual(restored.connected, true);

    const bobInJoined = joined.room.participants.find(p => p.name === 'Bob');
    assert.strictEqual(bobInJoined.connected, true);
  });

  test('race: a new connection joining before the old one is marked disconnected does not create a duplicate', async () => {
    // Simulates a flaky connection: the client reconnects with a fresh
    // socket BEFORE the server's ping-timeout has caught the old socket
    // dying (old entry still reads connected:true). No explicit
    // voter.disconnect() call here — that's the point of the race.
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    const bobJoined = await onceEvent(voter, 'room-joined');

    voter.emit('vote', { roomId, vote: '5' });
    await waitForRoomState(master, (room) => {
      const bob = room.participants.find(p => p.name === 'Bob');
      return bob && bob.hasVoted;
    });

    const oldBobId = voter.id;
    assert.strictEqual(rooms[roomId].participants[oldBobId].connected, true, 'old socket is still "connected" server-side');

    const kickedPromise = onceEvent(voter, 'kicked');
    const reconnectedBob = createClient();
    await waitForConnect(reconnectedBob);
    reconnectedBob.emit('join-room', { roomId, name: 'Bob', sessionToken: bobJoined.sessionToken });
    await onceEvent(reconnectedBob, 'room-joined');

    await kickedPromise; // the stale old connection gets evicted
    await new Promise(r => setTimeout(r, 100));

    const bobEntries = Object.values(rooms[roomId].participants).filter(p => p.name === 'Bob');
    assert.strictEqual(bobEntries.length, 1, 'exactly one Bob, no duplicate row');
    assert.strictEqual(bobEntries[0].id, reconnectedBob.id);
    assert.strictEqual(bobEntries[0].vote, '5', 'vote carried over despite the race');
    assert.strictEqual(rooms[roomId].participants[oldBobId], undefined, 'old entry cleaned up');
  });

  test('the evicted connection is told its seat moved, not that it was kicked', async () => {
    // The reconnect token lives in localStorage, which every tab of one
    // browser shares — so the common way to hit this path is opening the room
    // in a second tab, not a flaky reconnect. The first tab has to say so
    // rather than claim the host removed it.
    const master = createClient();
    const tabA   = createClient();
    await waitForConnect(master);
    await waitForConnect(tabA);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');

    tabA.emit('join-room', { roomId, name: 'Sam' });
    const { sessionToken } = await onceEvent(tabA, 'room-joined');

    const kickedPromise = onceEvent(tabA, 'kicked');
    const tabB = createClient();
    await waitForConnect(tabB);
    tabB.emit('join-room', { roomId, name: 'Sam', sessionToken });
    await onceEvent(tabB, 'room-joined');

    const payload = await kickedPromise;
    assert.strictEqual(payload?.reason, 'superseded', 'the first tab is told its seat moved');

    // A real kick stays a real kick: no reason, so the client keeps the
    // "you were removed" wording.
    const victim = createClient();
    await waitForConnect(victim);
    victim.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(victim, 'room-joined');

    const realKick = onceEvent(victim, 'kicked');
    master.emit('kick-user', { roomId, targetId: victim.id });
    assert.strictEqual((await realKick)?.reason, undefined, 'a host kick carries no reason');
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

  test('a room-wide outage does not hand the host role to whoever reconnects first', async () => {
    // Straight from a production log: one blip took out every phone and the
    // presenter screen inside the same second, and the room was down for 61
    // seconds. The 30s claim window fired mid-outage with nobody connected to
    // promote, gave up, and from then on the role went to the first phone
    // back — overwriting masterToken, so the real host, returning three
    // seconds later with that token, was demoted for good. Twice in one
    // session. The claim now stays open while there is nobody to hand it to.
    const hessel = createClient();
    const bas    = createClient();
    await waitForConnect(hessel);
    await waitForConnect(bas);

    hessel.emit('create-room', { name: 'globe', deckType: 'standard' });
    const { roomId } = await onceEvent(hessel, 'room-created');
    hessel.emit('join-room', { roomId, name: 'Hessel' });
    const hesselJoined = await onceEvent(hessel, 'room-joined');
    bas.emit('join-room', { roomId, name: 'Bas' });
    const basJoined = await onceEvent(bas, 'room-joined');

    assert.strictEqual(hesselJoined.isMaster, true, 'first joiner is host');
    const hesselSeat = hessel.id;

    // The outage: Hessel first (so a claim is opened), Bas right behind him.
    hessel.disconnect();
    await new Promise(r => setTimeout(r, 80));
    bas.disconnect();
    await new Promise(r => setTimeout(r, 120));
    assert.ok(rooms[roomId].masterGraceTimer, 'a claim is open on the host seat');

    // The window closes with nobody around — fired directly rather than
    // waiting out the real 30 seconds.
    runMasterHandover(ioServer, roomId, hesselSeat);
    assert.ok(rooms[roomId].masterGraceTimer, 'the claim is held open, not dropped');
    assert.strictEqual(rooms[roomId].masterId, hesselSeat, 'the seat is still the host\'s');

    // Bas is back first. He must not inherit the room.
    const basBack = createClient();
    await waitForConnect(basBack);
    basBack.emit('join-room', { roomId, name: 'Bas', sessionToken: basJoined.sessionToken });
    const basResult = await onceEvent(basBack, 'room-joined');
    assert.strictEqual(basResult.isMaster, false, 'reconnecting first does not make you the host');

    // Hessel follows, holding the master token.
    const hesselBack = createClient();
    await waitForConnect(hesselBack);
    hesselBack.emit('join-room', { roomId, name: 'Hessel', sessionToken: hesselJoined.sessionToken });
    const hesselResult = await onceEvent(hesselBack, 'room-joined');
    assert.strictEqual(hesselResult.isMaster, true, 'the token holder gets their room back');
    assert.strictEqual(rooms[roomId].masterId, hesselBack.id);
    assert.strictEqual(rooms[roomId].masterGraceTimer, null, 'the claim is settled');
  });

  test('the claim window still promotes someone who is actually present', async () => {
    const master = createClient();
    const voter  = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    const masterSeat = master.id;
    const promoted = onceEvent(voter, 'became-master');
    master.disconnect();
    await new Promise(r => setTimeout(r, 120));

    runMasterHandover(ioServer, roomId, masterSeat);
    await promoted;
    assert.strictEqual(rooms[roomId].masterId, voter.id, 'the one who is there takes over');
    assert.strictEqual(rooms[roomId].masterGraceTimer, null, 'and the claim is closed');
  });

  test('an expiring host seat hands the role on instead of leaving the room hostless', async () => {
    // The claim outliving the 30s window makes this the moment it finally
    // ends, so it is also the moment the role has to move. Same rule as a
    // kick: straight to the first connected survivor.
    const master = createClient();
    const voter  = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    const masterSeat = master.id;
    const promoted = onceEvent(voter, 'became-master');

    rooms[roomId].participants[masterSeat].connected = false;
    expireParticipantGrace(roomId, masterSeat);
    await promoted;

    assert.strictEqual(rooms[roomId].participants[masterSeat], undefined, 'the seat is gone');
    assert.strictEqual(rooms[roomId].masterId, voter.id, 'the role went to the survivor');
    assert.strictEqual(
      rooms[roomId].masterToken,
      rooms[roomId].participants[voter.id].sessionToken,
      'and the token moved with it, so the new host keeps it across a reconnect',
    );
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
