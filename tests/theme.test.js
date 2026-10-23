import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nextTheme, normalizeTheme } from '../public/js/theme.js';

describe('theme cycle', () => {
  test('cycles dark → light → coral and wraps back', () => {
    assert.strictEqual(nextTheme('dark'), 'light');
    assert.strictEqual(nextTheme('light'), 'coral');
    assert.strictEqual(nextTheme('coral'), 'dark');
  });

  test('every theme is reachable from every other', () => {
    const seen = new Set();
    let mode = 'dark';
    for (let i = 0; i < 3; i++) { seen.add(mode); mode = nextTheme(mode); }
    assert.deepStrictEqual([...seen].sort(), ['coral', 'dark', 'light']);
    assert.strictEqual(mode, 'dark', 'three steps return to the start');
  });

  // localStorage is user-writable, and the inline bootstrap in each page head
  // applies whatever it finds straight onto <html data-theme>.
  test('an unknown stored theme reads as dark rather than throwing', () => {
    for (const junk of ['bogus', '', null, undefined, 'constructor', '__proto__']) {
      assert.strictEqual(normalizeTheme(junk), 'dark', `for ${String(junk)}`);
      assert.strictEqual(nextTheme(junk), 'light', `for ${String(junk)}`);
    }
  });
});
