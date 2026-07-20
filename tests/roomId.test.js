import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateRoomId, normalizeRoomId } from '../src/utils/roomId.js';

describe('generateRoomId', () => {
  test('produces a 6-character code', () => {
    for (let i = 0; i < 50; i++) {
      assert.strictEqual(generateRoomId().length, 6);
    }
  });

  test('only uses the curated Crockford Base32 alphabet (no I, L, O, U)', () => {
    const allowed = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;
    for (let i = 0; i < 200; i++) {
      const id = generateRoomId();
      assert.match(id, allowed, `"${id}" must only contain unambiguous characters`);
      assert.ok(!/[ILOU]/.test(id), `"${id}" must not contain visually ambiguous I, L, O, or U`);
    }
  });

  test('is already uppercase', () => {
    const id = generateRoomId();
    assert.strictEqual(id, id.toUpperCase());
  });

  test('produces distinct codes across many calls (no obvious generator bug)', () => {
    const ids = new Set();
    for (let i = 0; i < 500; i++) ids.add(generateRoomId());
    // 32^6 ≈ 1.07 billion combinations; 500 draws colliding would indicate a bug.
    assert.ok(ids.size > 490, `expected near-500 unique ids, got ${ids.size}`);
  });
});

describe('normalizeRoomId', () => {
  test('trims and uppercases', () => {
    assert.strictEqual(normalizeRoomId('  ab12cd  '), 'AB12CD');
  });

  test('handles missing/non-string input', () => {
    assert.strictEqual(normalizeRoomId(undefined), '');
    assert.strictEqual(normalizeRoomId(null), '');
    assert.strictEqual(normalizeRoomId(''), '');
  });

  test('a generated id survives a normalize round-trip unchanged', () => {
    const id = generateRoomId();
    assert.strictEqual(normalizeRoomId(id), id);
    assert.strictEqual(normalizeRoomId(id.toLowerCase()), id);
  });
});
