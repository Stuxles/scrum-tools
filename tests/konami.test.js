import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pushKonamiKey } from '../public/js/utils/konami.js';

const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
              'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** Feeds keys through the matcher and returns how many times it completed. */
function type(keys) {
  let recent = [];
  let hits   = 0;
  for (const key of keys) {
    const step = pushKonamiKey(recent, key);
    recent = step.recent;
    if (step.complete) hits++;
  }
  return hits;
}

describe('pushKonamiKey (Konami-code sequence matcher)', () => {
  test('the code completes exactly once', () => {
    assert.strictEqual(type(CODE), 1);
  });

  test('entering it twice in a row fires twice', () => {
    assert.strictEqual(type([...CODE, ...CODE]), 2);
  });

  test('a wrong key in the middle breaks the run', () => {
    assert.strictEqual(type(['ArrowUp', 'ArrowUp', 'ArrowDown', 'x', ...CODE.slice(4)]), 0);
  });

  test('an extra leading up-arrow still completes — the window slides, it does not reset', () => {
    assert.strictEqual(type(['ArrowUp', ...CODE]), 1);
  });

  test('unrelated typing before the code does not spoil it', () => {
    assert.strictEqual(type(['a', 'b', 'c', 'Enter', ...CODE]), 1);
  });

  test('unrelated typing on its own does not complete it', () => {
    assert.strictEqual(type(['a', 'b', 'c', 'Enter', 'ArrowDown', 'ArrowUp']), 0);
  });

  test('a half-entered code sits and waits', () => {
    assert.strictEqual(type(CODE.slice(0, -1)), 0);
  });

  test('keeps at most ten keys, so the window cannot grow with the session', () => {
    let recent = [];
    for (const key of [...CODE, ...CODE, 'x', 'y']) {
      recent = pushKonamiKey(recent, key).recent;
    }
    assert.strictEqual(recent.length, 10);
  });
});
