import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import { initBroadcast } from '../src/utils/broadcast.js';
import { initSocketHandlers } from '../src/socket/index.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';
import { MAX_ROOMS, MAX_PARTICIPANTS_PER_ROOM } from '../src/config.js';
import { translateServerMsg, translations } from '../public/js/utils/i18n.js';

/**
 * The seam between the server (English everywhere) and the bilingual UI.
 *
 * `translateServerMsg()` matches the server's error sentences by substring to
 * pick an i18n key. Nothing links the two ends: reword a message in `src/`
 * and the arm that catches it keeps compiling, keeps passing every other
 * test, and silently shows raw English to a Dutch viewer.
 *
 * So these tests do not assert on a hardcoded copy of the sentence — that
 * would drift with it. They provoke each error against a real server, take
 * whatever the handler actually emitted, and push it through the real
 * matcher. If the two ends stop agreeing, this fails.
 */
describe('Server error messages reach the UI translated', () => {
  let httpServer;
  let ioServer;
  let port;
  let originalLocalStorage;
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

  // `t()` reads the language out of localStorage, which Node does not have.
  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    };
    for (const c of activeClients) { if (c.connected) c.disconnect(); }
    activeClients.length = 0;
    for (const key of Object.keys(rooms)) deleteRoom(key);
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
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

  /**
   * The message is translated when the matcher recognised it: the Dutch text
   * differs from what came off the wire, and is not the bare i18n key (which
   * is what `t()` returns for a key that does not exist).
   */
  function assertTranslated(emitted, expectedKey) {
    globalThis.localStorage.setItem('scrum_lang', 'nl');
    const shown = translateServerMsg(emitted);

    assert.notStrictEqual(shown, emitted,
      `the server said "${emitted}" and translateServerMsg() did not recognise it`);
    assert.notStrictEqual(shown, expectedKey,
      `${expectedKey} is missing from the dictionary, so t() returned the key itself`);
    assert.strictEqual(shown, translations.nl[expectedKey]);
  }

  test('"room does not exist" from join-room', async () => {
    const client = createClient();
    await waitForConnect(client);
    client.emit('join-room', { roomId: 'NOSUCH', name: 'Alice' });
    const err = await onceEvent(client, 'error');
    assertTranslated(err.message, 'toast-room-not-found-generic');
  });

  test('"room does not exist" from watch-room', async () => {
    const client = createClient();
    await waitForConnect(client);
    client.emit('watch-room', { roomId: 'NOSUCH' });
    const err = await onceEvent(client, 'error');
    assertTranslated(err.message, 'toast-room-not-found-generic');
  });

  test('"too few cards" from create-room', async () => {
    const client = createClient();
    await waitForConnect(client);
    client.emit('create-room', { deckType: 'custom', customCards: ['1'], roomName: 'Thin' });
    const err = await onceEvent(client, 'error');
    assertTranslated(err.message, 'toast-min-cards');
  });

  test('"too few cards" from change-deck', async () => {
    const client = createClient();
    await waitForConnect(client);
    client.emit('create-room', { deckType: 'standard', roomName: 'Decks' });
    const { roomId } = await onceEvent(client, 'room-created');
    client.emit('join-room', { roomId, name: 'Alice' });
    await onceEvent(client, 'room-joined');

    client.emit('change-deck', { roomId, deckType: 'custom', customCards: ['1'] });
    const err = await onceEvent(client, 'error');
    assertTranslated(err.message, 'toast-min-cards');
  });

  test('"server at its room limit" from create-room', async () => {
    const client = createClient();
    await waitForConnect(client);
    // Fill the store directly: MAX_ROOMS real create-room calls would trip the
    // per-socket rate limiter long before they reached the ceiling.
    for (let i = 0; i < MAX_ROOMS; i++) rooms[`FULL${i}`] = { id: `FULL${i}`, participants: {}, displays: new Set() };

    client.emit('create-room', { deckType: 'standard', roomName: 'One too many' });
    const err = await onceEvent(client, 'error');
    assertTranslated(err.message, 'toast-rooms-limit');
  });

  test('"room is full" from join-room', async () => {
    const client = createClient();
    await waitForConnect(client);
    client.emit('create-room', { deckType: 'standard', roomName: 'Packed' });
    const { roomId } = await onceEvent(client, 'room-created');
    const room = rooms[roomId];
    for (let i = 0; i < MAX_PARTICIPANTS_PER_ROOM; i++) {
      room.participants[`seat${i}`] = { id: `seat${i}`, name: `P${i}`, vote: null, hasVoted: false, connected: true };
    }

    client.emit('join-room', { roomId, name: 'Zoe' });
    const err = await onceEvent(client, 'error');
    assertTranslated(err.message, 'toast-room-full');
  });

  test('"too many actions" from the per-socket rate limiter', async () => {
    const client = createClient();
    await waitForConnect(client);
    const errored = onceEvent(client, 'error');
    // The limiter counts every event, so any 36 in one second will do.
    for (let i = 0; i < 40; i++) client.emit('vote', { roomId: 'NOSUCH', vote: '5' });
    const err = await errored;
    assertTranslated(err.message, 'toast-rate-limit');
  });

  test('"something went wrong" when a handler throws', async () => {
    // The safe dispatch in src/socket/index.js turns any handler throw into
    // this one message. `update-story-title` on a room the sender controls,
    // with a payload that cannot be stringified, is the cheapest way there.
    const client = createClient();
    await waitForConnect(client);
    client.emit('create-room', { deckType: 'standard', roomName: 'Throws' });
    const { roomId } = await onceEvent(client, 'room-created');
    client.emit('join-room', { roomId, name: 'Alice' });
    await onceEvent(client, 'room-joined');

    const errored = onceEvent(client, 'error');
    client.emit('update-story-title', { roomId, storyTitle: { toString: null } });
    const err = await errored;
    assertTranslated(err.message, 'toast-generic-error');
  });

  test('an unrecognised message passes through untouched', () => {
    // Every toast() goes through this function, including ones the client
    // already translated itself. Those must survive unchanged.
    globalThis.localStorage.setItem('scrum_lang', 'nl');
    assert.strictEqual(translateServerMsg('Naam bijgewerkt'), 'Naam bijgewerkt');
  });
});
