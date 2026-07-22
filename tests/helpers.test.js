import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { escHtml, getConfettiEnabled, setConfettiEnabled, LS_CONFETTI } from '../public/js/utils/helpers.js';

describe('escHtml (XSS-prevention HTML escaping)', () => {
  test('escapes all special characters', () => {
    assert.strictEqual(escHtml('&'), '&amp;');
    assert.strictEqual(escHtml('<'), '&lt;');
    assert.strictEqual(escHtml('>'), '&gt;');
    assert.strictEqual(escHtml('"'), '&quot;');
    assert.strictEqual(escHtml("'"), '&#039;');
    assert.strictEqual(escHtml('`'), '&#x60;');
  });

  test('neutralizes a script-tag injection attempt', () => {
    const out = escHtml('<script>alert(1)</script>');
    assert.strictEqual(out, '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.ok(!out.includes('<script>'), 'no raw <script> tag survives escaping');
  });

  test('neutralizes an attribute-breakout attempt', () => {
    const out = escHtml('" onerror="alert(1)');
    assert.ok(!out.includes('"'), 'double quotes are escaped so the attribute cannot be broken out of');
  });

  test('leaves plain text unchanged', () => {
    assert.strictEqual(escHtml('Alice'), 'Alice');
    assert.strictEqual(escHtml('Sprint 42 Planning'), 'Sprint 42 Planning');
  });

  test('coerces non-string input to a string first', () => {
    assert.strictEqual(escHtml(42), '42');
    assert.strictEqual(escHtml(null), 'null');
  });

  test('& is escaped first so entities are not double-escaped', () => {
    assert.strictEqual(escHtml('&lt;'), '&amp;lt;');
  });
});

describe('confetti "no fun mode" preference (getConfettiEnabled/setConfettiEnabled)', () => {
  let originalLocalStorage;
  let store;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  test('defaults to enabled (true) when never set', () => {
    assert.strictEqual(getConfettiEnabled(), true);
  });

  test('setConfettiEnabled(false) persists and getConfettiEnabled reflects it ("no fun mode")', () => {
    setConfettiEnabled(false);
    assert.strictEqual(store.get(LS_CONFETTI), 'false');
    assert.strictEqual(getConfettiEnabled(), false);
  });

  test('setConfettiEnabled(true) after being off turns it back on', () => {
    setConfettiEnabled(false);
    setConfettiEnabled(true);
    assert.strictEqual(getConfettiEnabled(), true);
  });

  test('only the literal string "false" disables it — any other stored value is treated as enabled', () => {
    store.set(LS_CONFETTI, 'true');
    assert.strictEqual(getConfettiEnabled(), true);
    store.set(LS_CONFETTI, 'garbage');
    assert.strictEqual(getConfettiEnabled(), true, 'defensive: unexpected stored value does not silently disable');
  });
});
