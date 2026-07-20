import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DECKS, APP_NAME, PORT, CORS_ORIGIN, RECONNECT_GRACE_PERIOD_MS, TRUST_PROXY, parseTrustProxy } from '../src/config.js';
import { translations } from '../public/js/utils/i18n.js';

describe('Config & i18n Dictionary verification', () => {
  test('DECKS should contain standard, fibonacci, and tshirt decks with valid card choices', () => {
    assert.ok(DECKS.standard, 'Standard deck must exist');
    assert.ok(DECKS.fibonacci, 'Fibonacci deck must exist');
    assert.ok(DECKS.tshirt, 'T-Shirt deck must exist');

    for (const [deckName, cards] of Object.entries(DECKS)) {
      assert.ok(Array.isArray(cards), `${deckName} deck must be an array`);
      assert.ok(cards.length >= 2, `${deckName} deck must have at least 2 cards`);
      assert.ok(cards.includes('❓'), `${deckName} deck must contain the '❓' card`);
      assert.ok(cards.includes('☕'), `${deckName} deck must contain the '☕' coffee break card`);
    }
  });

  test('Config constants should have sensible defaults', () => {
    assert.ok(APP_NAME, 'APP_NAME must be defined');
    assert.ok(typeof PORT === 'number' || typeof PORT === 'string', 'PORT must be set');
    assert.ok(CORS_ORIGIN, 'CORS_ORIGIN must be defined');
    assert.strictEqual(RECONNECT_GRACE_PERIOD_MS, 15 * 60 * 1000, 'Grace period must be 15 minutes');
    assert.strictEqual(TRUST_PROXY, false, 'TRUST_PROXY must default to false when the env var is unset');
  });

  test('parseTrustProxy: safe default and Express-recognized value forms', () => {
    assert.strictEqual(parseTrustProxy(undefined), false, 'unset -> false (untrusted, safe default)');
    assert.strictEqual(parseTrustProxy(''), false);
    assert.strictEqual(parseTrustProxy('true'), true);
    assert.strictEqual(parseTrustProxy('false'), false);
    assert.strictEqual(parseTrustProxy('1'), 1, 'numeric hop count is parsed to a Number');
    assert.strictEqual(parseTrustProxy('2'), 2);
    assert.strictEqual(parseTrustProxy('loopback'), 'loopback', 'named/CIDR values pass through for Express to interpret');
    assert.strictEqual(parseTrustProxy('10.0.0.1/8'), '10.0.0.1/8');
  });

  test('i18n translations dictionary should have matching keys between NL and EN', () => {
    assert.ok(translations.nl, 'Dutch translations dictionary must exist');
    assert.ok(translations.en, 'English translations dictionary must exist');

    const nlKeys = Object.keys(translations.nl).sort();
    const enKeys = Object.keys(translations.en).sort();

    assert.strictEqual(nlKeys.length, enKeys.length, `NL dictionary has ${nlKeys.length} keys but EN has ${enKeys.length}`);

    // Find missing keys in EN
    const missingInEn = nlKeys.filter(k => !translations.en[k]);
    assert.strictEqual(missingInEn.length, 0, `Keys missing in EN dictionary: ${missingInEn.join(', ')}`);

    // Find missing keys in NL
    const missingInNl = enKeys.filter(k => !translations.nl[k]);
    assert.strictEqual(missingInNl.length, 0, `Keys missing in NL dictionary: ${missingInNl.join(', ')}`);
  });
});
