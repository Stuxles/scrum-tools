import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { info, warn, error, formatTimestamp } from '../src/utils/logger.js';

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/;
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[\d+m/;

describe('formatTimestamp', () => {
  test('formats as local YYYY-MM-DD HH:mm:ss.SSS, no brackets, no T/Z', () => {
    const out = formatTimestamp(new Date(2026, 0, 5, 9, 3, 7, 42));
    assert.strictEqual(out, '2026-01-05 09:03:07.042');
  });

  test('pads single-digit month/day/hour/minute/second and short milliseconds', () => {
    const out = formatTimestamp(new Date(2026, 8, 1, 1, 1, 1, 5));
    assert.strictEqual(out, '2026-09-01 01:01:01.005');
  });

  test('defaults to "now" when called with no argument', () => {
    const out = formatTimestamp();
    assert.match(out, TIMESTAMP_RE);
  });
});

describe('info/warn/error (leveled, column-aligned console wrapper)', () => {
  let originalLog, originalError, originalStdoutIsTTY, originalStderrIsTTY;
  let logCalls, errorCalls;

  beforeEach(() => {
    originalLog = console.log;
    originalError = console.error;
    originalStdoutIsTTY = process.stdout.isTTY;
    originalStderrIsTTY = process.stderr.isTTY;
    // Force non-TTY so output is plain (deterministic to assert on);
    // color behavior is covered separately below.
    process.stdout.isTTY = false;
    process.stderr.isTTY = false;
    logCalls = [];
    errorCalls = [];
    console.log = (...args) => logCalls.push(args);
    console.error = (...args) => errorCalls.push(args);
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    process.stdout.isTTY = originalStdoutIsTTY;
    process.stderr.isTTY = originalStderrIsTTY;
  });

  test('info() writes to console.log with a timestamp, padded INFO level, and bracketed tag', () => {
    info('join', 'Bob → ABC123');
    assert.strictEqual(logCalls.length, 1);
    const [prefix, message] = logCalls[0];
    // Timestamp is fixed-width "YYYY-MM-DD HH:mm:ss.SSS" (23 chars); split
    // the rest on whitespace, since the timestamp itself contains a space.
    const timestamp = prefix.slice(0, 23);
    const [level, tag] = prefix.slice(23).trim().split(/\s+/);
    assert.match(timestamp, TIMESTAMP_RE);
    assert.strictEqual(level, 'INFO');
    assert.strictEqual(tag, '[join]');
    assert.strictEqual(message, 'Bob → ABC123');
  });

  test('warn() writes to console.log (not console.error) with WARN level', () => {
    warn('rate-limit', 'socket abc123 exceeded 35 events/sec');
    assert.strictEqual(logCalls.length, 1);
    assert.strictEqual(errorCalls.length, 0);
    assert.ok(logCalls[0][0].includes('WARN'));
  });

  test('error() writes to console.error (not console.log) with ERROR level', () => {
    const err = new Error('boom');
    error('handler:vote', 'abc123', err);
    assert.strictEqual(logCalls.length, 0, 'must not also write to console.log');
    assert.strictEqual(errorCalls.length, 1);
    const [prefix, ...rest] = errorCalls[0];
    assert.ok(prefix.includes('ERROR'));
    assert.deepStrictEqual(rest, ['abc123', err]);
  });

  test('the level field is padded to a fixed width regardless of level name length', () => {
    info('x', 'msg');
    warn('y', 'msg');
    const [prefixInfo] = logCalls[0];
    const [prefixWarn] = logCalls[1];
    // "INFO " (4 chars + 1 pad) and "WARN " (4 chars + 1 pad) must occupy
    // the exact same column width, so the [tag] that follows lines up.
    // Timestamp is a fixed-width "YYYY-MM-DD HH:mm:ss.SSS" (23 chars).
    const tagStartInfo = prefixInfo.indexOf('[', 23);
    const tagStartWarn = prefixWarn.indexOf('[', 23);
    assert.ok(tagStartInfo > 23 && tagStartWarn > 23, 'sanity: found the [tag] after the timestamp');
    assert.strictEqual(tagStartInfo, tagStartWarn, 'the [tag] column must start at the same offset for every level');
  });

  test('the tag field is padded to a fixed width, so the message starts at the same column', () => {
    // 'transfer-master' (15 chars -> "[transfer-master]" = 17) fits within
    // the 18-wide tag column with room to spare; both should pad equal.
    info('x', 'short-tag-message');
    info('transfer-master', 'long-tag-message');
    const [prefixShort, msgShort] = logCalls[0];
    const [prefixLong, msgLong] = logCalls[1];
    assert.strictEqual(prefixShort.length, prefixLong.length, 'padded prefixes must be equal length for tags within the column budget');
    assert.strictEqual(msgShort, 'short-tag-message');
    assert.strictEqual(msgLong, 'long-tag-message');
  });

  test('a tag longer than the column budget overflows rather than being truncated', () => {
    info('this-tag-is-way-too-long-for-the-column', 'still readable');
    const [, message] = logCalls[0];
    assert.strictEqual(message, 'still readable', 'the message argument itself is never mangled by a long tag');
  });

  test('no ANSI color codes are emitted when the destination stream is not a TTY', () => {
    info('room', 'ABC123 aangemaakt door Alice');
    const [prefix] = logCalls[0];
    assert.ok(!ANSI_RE.test(prefix), 'non-TTY output must be plain text');
  });
});

describe('info/warn/error color output (TTY)', () => {
  let originalLog, originalStdoutIsTTY;
  let logCalls;

  beforeEach(() => {
    originalLog = console.log;
    originalStdoutIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;
    logCalls = [];
    console.log = (...args) => logCalls.push(args);
  });

  afterEach(() => {
    console.log = originalLog;
    process.stdout.isTTY = originalStdoutIsTTY;
  });

  test('ANSI color codes are included when the destination stream is a TTY', () => {
    info('room', 'ABC123 aangemaakt door Alice');
    const [prefix] = logCalls[0];
    assert.match(prefix, ANSI_RE, 'TTY output should include ANSI color codes');
  });
});
