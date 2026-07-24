import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';
import { DECKS } from '../src/config.js';

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

  test('sm-transfer-master should transfer master status to target participant', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');

    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');

    voter.emit('join-room', { roomId, name: 'Voter Bob' });
    const voterJoined = await onceEvent(voter, 'room-joined');
    const targetId = voterJoined.room.participants.find(p => p.name === 'Voter Bob').id;

    const becameMasterPromise = onceEvent(voter, 'became-master');
    master.emit('sm-transfer-master', { roomId, targetId });

    await becameMasterPromise;
    assert.ok(true, 'Target received became-master event');
  });

  test('claim-master should allow a participant to take over Scrum Master role', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');

    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');

    voter.emit('join-room', { roomId, name: 'Voter Bob' });
    await onceEvent(voter, 'room-joined');

    const becameMasterPromise = onceEvent(voter, 'became-master');
    voter.emit('claim-master', { roomId });

    await becameMasterPromise;
    assert.ok(true, 'Voter received became-master event after claiming');
  });

  test('auto-reveal off by default: room stays unrevealed when all voters have voted', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'fibonacci' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    voter.emit('vote', { roomId, vote: '8' });
    await new Promise(r => setTimeout(r, 150));

    assert.strictEqual(rooms[roomId].autoReveal, false, 'autoReveal defaults to false');
    assert.strictEqual(rooms[roomId].revealed, false, 'Room must not auto-reveal when disabled');
  });

  test('auto-reveal enabled: room reveals automatically once every voter has voted', async () => {
    const master = createClient();
    const a = createClient();
    const b = createClient();
    await waitForConnect(master);
    await waitForConnect(a);
    await waitForConnect(b);

    master.emit('create-room', { name: 'SM', deckType: 'fibonacci' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    a.emit('join-room', { roomId, name: 'Alice' });
    await onceEvent(a, 'room-joined');
    b.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(b, 'room-joined');

    master.emit('toggle-auto-reveal', { roomId, autoReveal: true });
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(rooms[roomId].autoReveal, true);

    // First vote must NOT reveal (Bob still pending)
    a.emit('vote', { roomId, vote: '5' });
    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(rooms[roomId].revealed, false, 'Must not reveal while a voter is pending');

    // Second (final) vote triggers the auto-reveal
    b.emit('vote', { roomId, vote: '8' });
    const revealedRoom = await new Promise((resolve) => {
      const handler = ({ room }) => {
        if (room.revealed === true) { master.off('room-state', handler); resolve(room); }
      };
      master.on('room-state', handler);
    });

    assert.strictEqual(revealedRoom.revealed, true, 'Room auto-revealed after last vote');
    const votes = revealedRoom.participants.filter(p => !p.isMaster).map(p => p.vote).sort();
    assert.deepStrictEqual(votes, ['5', '8'], 'All votes visible after auto-reveal');
  });

  test('enabling auto-reveal when everyone already voted reveals immediately', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'fibonacci' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    voter.emit('vote', { roomId, vote: '13' });
    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(rooms[roomId].revealed, false);

    master.emit('toggle-auto-reveal', { roomId, autoReveal: true });
    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(rooms[roomId].revealed, true, 'Enabling with all votes in reveals at once');
  });

  test('auto-reveal ignores the Scrum Master and spectators when deciding', async () => {
    const master = createClient();
    const voter = createClient();
    const spectator = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);
    await waitForConnect(spectator);

    master.emit('create-room', { name: 'SM', deckType: 'fibonacci' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');
    spectator.emit('join-room', { roomId, name: 'Eve', isSpectator: true });
    await onceEvent(spectator, 'room-joined');

    master.emit('toggle-auto-reveal', { roomId, autoReveal: true });
    await new Promise(r => setTimeout(r, 100));

    // Bob is the only real voter; SM and spectator must not block the reveal
    voter.emit('vote', { roomId, vote: '3' });
    await new Promise(r => setTimeout(r, 150));
    assert.strictEqual(rooms[roomId].revealed, true, 'SM and spectators excluded from the check');
  });

  test('non-master cannot toggle auto-reveal', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM', deckType: 'fibonacci' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Bob' });
    await onceEvent(voter, 'room-joined');

    voter.emit('toggle-auto-reveal', { roomId, autoReveal: true });
    await new Promise(r => setTimeout(r, 150));

    assert.strictEqual(rooms[roomId].autoReveal, false, 'Only the Scrum Master may toggle auto-reveal');
  });

  test('disconnecting SM starts 30s grace period instead of immediate transfer, and reconnecting recovers role', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'SM Grace', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');

    master.emit('join-room', { roomId, name: 'Original SM' });
    const smJoined = await onceEvent(master, 'room-joined');

    voter.emit('join-room', { roomId, name: 'Voter Bob' });
    await onceEvent(voter, 'room-joined');

    // Master disconnects suddenly
    let becameMasterFired = false;
    voter.on('became-master', () => { becameMasterFired = true; });

    master.disconnect();
    await new Promise(resolve => setTimeout(resolve, 200));

    assert.strictEqual(becameMasterFired, false, 'Voter Bob should NOT become master right after disconnect due to 30s grace timer');

    // Original SM reconnects with a new socket, replaying their token, within 30s
    const masterReconnected = createClient();
    await waitForConnect(masterReconnected);
    masterReconnected.emit('join-room', { roomId, name: 'Original SM', sessionToken: smJoined.sessionToken });
    const rejoined = await onceEvent(masterReconnected, 'room-joined');

    assert.strictEqual(rejoined.isMaster, true, 'Original SM recovered master role during grace window');
    assert.strictEqual(becameMasterFired, false, 'Voter Bob never received became-master');
  });

  test('an impostor typing the departed SM\'s name does NOT get the master role', async () => {
    const master = createClient();
    const voter = createClient();
    await waitForConnect(master);
    await waitForConnect(voter);

    master.emit('create-room', { name: 'Original SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'Original SM' });
    await onceEvent(master, 'room-joined');
    voter.emit('join-room', { roomId, name: 'Voter Bob' });
    await onceEvent(voter, 'room-joined');

    master.disconnect();
    await new Promise(r => setTimeout(r, 200)); // inside the 30s master grace

    // Same display name, no session token — must be treated as a stranger.
    const impostor = createClient();
    await waitForConnect(impostor);
    impostor.emit('join-room', { roomId, name: 'Original SM' });
    const joined = await onceEvent(impostor, 'room-joined');

    assert.strictEqual(joined.isMaster, false, 'name alone must not grant the Scrum Master role');
    assert.notStrictEqual(rooms[roomId].masterId, impostor.id);
  });

  test('two different people sharing a display name both keep their own seat', async () => {
    const master = createClient();
    const janA = createClient();
    const janB = createClient();
    await waitForConnect(master);
    await waitForConnect(janA);
    await waitForConnect(janB);

    master.emit('create-room', { name: 'SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'SM' });
    await onceEvent(master, 'room-joined');

    janA.emit('join-room', { roomId, name: 'Jan' });
    await onceEvent(janA, 'room-joined');
    janA.emit('vote', { roomId, vote: '5' });
    await new Promise(r => setTimeout(r, 100));

    // A second, unrelated Jan joins. The first Jan must not be evicted.
    let firstJanKicked = false;
    janA.on('kicked', () => { firstJanKicked = true; });

    janB.emit('join-room', { roomId, name: 'Jan' });
    await onceEvent(janB, 'room-joined');
    await new Promise(r => setTimeout(r, 150));

    assert.strictEqual(firstJanKicked, false, 'the first Jan must not be kicked out by a namesake');
    assert.strictEqual(janA.connected, true, 'the first Jan stays connected');

    const jans = Object.values(rooms[roomId].participants).filter(p => p.name === 'Jan');
    assert.strictEqual(jans.length, 2, 'both Jans have their own seat');
    assert.strictEqual(rooms[roomId].participants[janA.id].vote, '5', "the first Jan keeps their own vote");
    assert.strictEqual(rooms[roomId].participants[janB.id].vote, null, 'the second Jan does not inherit a vote');
  });

  test('a room whose SM left with nobody around hands the role to the next joiner', async () => {
    // The SM was the only one connected, so no master grace timer is armed
    // (there was nobody to hand the role to). Their seat lingers as "away"
    // for the participant grace window — which used to block the auto-master
    // fallback in handleJoinRoom and leave the room permanently SM-less.
    const master = createClient();
    await waitForConnect(master);

    master.emit('create-room', { name: 'Lonely SM', deckType: 'standard' });
    const { roomId } = await onceEvent(master, 'room-created');
    master.emit('join-room', { roomId, name: 'Lonely SM' });
    await onceEvent(master, 'room-joined');

    master.disconnect();
    await new Promise(r => setTimeout(r, 150));

    assert.strictEqual(rooms[roomId].masterGraceTimer, undefined, 'no grace timer is armed when nobody is left');

    const newcomer = createClient();
    await waitForConnect(newcomer);
    newcomer.emit('join-room', { roomId, name: 'Newcomer' });
    const joined = await onceEvent(newcomer, 'room-joined');

    assert.strictEqual(joined.isMaster, true, 'the room must not stay stuck without a reachable Scrum Master');
    assert.strictEqual(rooms[roomId].masterId, newcomer.id);
  });

  test('a room gets its own copy of a preset deck, not a reference to the shared one', async () => {
    const client = createClient();
    await waitForConnect(client);

    client.emit('create-room', { name: 'SM', deckType: 'fibonacci' });
    const { roomId } = await onceEvent(client, 'room-created');

    assert.notStrictEqual(rooms[roomId].deck, DECKS.fibonacci, 'must not alias the shared preset array');
    assert.deepStrictEqual(rooms[roomId].deck, DECKS.fibonacci, 'but must hold the same cards');

    // Mutating one room's deck must not leak into the preset every other
    // room (and every future room) is built from.
    rooms[roomId].deck.push('999');
    assert.ok(!DECKS.fibonacci.includes('999'), 'the shared preset stays untouched');
  });

  test('a whitespace-only name falls back to Anoniem instead of an empty label', async () => {
    const client = createClient();
    await waitForConnect(client);

    client.emit('create-room', { name: '   ', deckType: 'standard' });
    const { roomId } = await onceEvent(client, 'room-created');
    client.emit('join-room', { roomId, name: '   ' });
    const joined = await onceEvent(client, 'room-joined');

    assert.strictEqual(joined.room.participants[0].name, 'Anoniem');
    assert.ok(rooms[roomId].name.length > 0, 'room name never ends up empty either');
  });
});
