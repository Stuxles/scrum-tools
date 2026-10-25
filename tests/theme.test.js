import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTheme } from '../public/js/theme.js';

describe('theme picker', () => {
  // localStorage is user-writable, and the inline bootstrap in each page head
  // applies whatever it finds straight onto <html data-theme>. The picker
  // sends its <option> value back through here for the same reason.
  test('anything unknown reads as the coral default rather than throwing', () => {
    for (const junk of ['bogus', '', null, undefined, 'constructor', '__proto__']) {
      assert.strictEqual(normalizeTheme(junk), 'coral', `for ${String(junk)}`);
    }
  });

  test('each theme reads as itself', () => {
    for (const mode of ['coral', 'dark', 'light']) {
      assert.strictEqual(normalizeTheme(mode), mode);
    }
  });
});
