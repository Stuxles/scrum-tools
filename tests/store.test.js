import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { rooms, deleteRoom, sanitizeRoom } from '../src/store/rooms.js';

describe('Store: rooms & sanitizeRoom', () => {
  beforeEach(() => {
    for (const key of Object.keys(rooms)) {
      deleteRoom(key);
    }
  });

  after(() => {
    for (const key of Object.keys(rooms)) {
      deleteRoom(key);
    }
  });

  test('deleteRoom should remove room and clear cleanup/disconnect timers', () => {
    let cleanupFired = false;
    let disconnectFired = false;

    rooms['ROOM01'] = {
      id: 'ROOM01',
      name: 'Test Room',
      masterId: 'socket-1',
      cleanupTimer: setTimeout(() => { cleanupFired = true; }, 10000),
      disconnectTimer: setTimeout(() => { disconnectFired = true; }, 10000),
      participants: {}
    };

    assert.ok(rooms['ROOM01']);
    deleteRoom('ROOM01');
    assert.strictEqual(rooms['ROOM01'], undefined);
    assert.strictEqual(cleanupFired, false);
    assert.strictEqual(disconnectFired, false);
  });

  test('deleteRoom should do nothing if room does not exist', () => {
    assert.doesNotThrow(() => {
      deleteRoom('NON_EXISTENT');
    });
  });

  test('sanitizeRoom should hide votes of other participants when unrevealed', () => {
    const room = {
      id: 'ROOM02',
      name: 'Secret Room',
      masterId: 'master-socket',
      deckType: 'standard',
      deck: ['1', '2', '3'],
      revealed: false,
      storyTitle: 'Refactor Auth (#101)',
      participants: {
        'master-socket': { id: 'master-socket', name: 'Scrum Master', vote: '3', hasVoted: true },
        'voter-socket':  { id: 'voter-socket', name: 'Voter Bob', vote: '5', hasVoted: true }
      }
    };

    const sanitizedGeneric = sanitizeRoom(room);
    assert.strictEqual(sanitizedGeneric.revealed, false);
    assert.strictEqual(sanitizedGeneric.storyTitle, 'Refactor Auth (#101)');
    assert.strictEqual(sanitizedGeneric.participants[0].vote, null);
    assert.strictEqual(sanitizedGeneric.participants[1].vote, null);
    assert.strictEqual(sanitizedGeneric.participants[1].hasVoted, true);
  });

  test('sanitizeRoom should allow viewer to see their own vote when unrevealed', () => {
    const room = {
      id: 'ROOM03',
      name: 'Voter Room',
      masterId: 'master-socket',
      deckType: 'standard',
      deck: ['1', '2', '3'],
      revealed: false,
      participants: {
        'master-socket': { id: 'master-socket', name: 'Scrum Master', vote: '3', hasVoted: true },
        'voter-socket':  { id: 'voter-socket', name: 'Voter Bob', vote: '8', hasVoted: true }
      }
    };

    const sanitizedForBob = sanitizeRoom(room, 'voter-socket');
    const bob = sanitizedForBob.participants.find(p => p.id === 'voter-socket');
    const master = sanitizedForBob.participants.find(p => p.id === 'master-socket');

    assert.strictEqual(bob.vote, '8', 'Voter should see their own vote before reveal');
    assert.strictEqual(master.vote, null, 'Voter should NOT see other participants votes before reveal');
  });

  test('sanitizeRoom should reveal all votes when revealed is true', () => {
    const room = {
      id: 'ROOM04',
      name: 'Revealed Room',
      masterId: 'master-socket',
      deckType: 'standard',
      deck: ['1', '2', '3'],
      revealed: true,
      participants: {
        'master-socket': { id: 'master-socket', name: 'Scrum Master', vote: '3', hasVoted: true },
        'voter-socket':  { id: 'voter-socket', name: 'Voter Bob', vote: '13', hasVoted: true }
      }
    };

    const sanitized = sanitizeRoom(room, 'voter-socket');
    const bob = sanitized.participants.find(p => p.id === 'voter-socket');
    const master = sanitized.participants.find(p => p.id === 'master-socket');

    assert.strictEqual(bob.vote, '13');
    assert.strictEqual(master.vote, '3');
  });

  test('sanitizeRoom should correctly identify master and spectator roles and default storyTitle', () => {
    const room = {
      id: 'ROOM05',
      name: 'Role Room',
      masterId: 'master-socket',
      deckType: 'tshirt',
      deck: ['XS', 'S', 'M'],
      revealed: false,
      participants: {
        'master-socket': { id: 'master-socket', name: 'SM Alice', vote: null, hasVoted: false, isSpectator: false },
        'spec-socket':   { id: 'spec-socket', name: 'Viewer Charlie', vote: null, hasVoted: false, isSpectator: true }
      }
    };

    const sanitized = sanitizeRoom(room);
    assert.strictEqual(sanitized.storyTitle, '');
    const master = sanitized.participants.find(p => p.id === 'master-socket');
    const spectator = sanitized.participants.find(p => p.id === 'spec-socket');

    assert.strictEqual(master.isMaster, true);
    assert.strictEqual(master.isSpectator, false);
    assert.strictEqual(spectator.isMaster, false);
    assert.strictEqual(spectator.isSpectator, true);
  });
});
