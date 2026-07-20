import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeVoteStats } from '../public/js/utils/stats.js';

describe('computeVoteStats (pure vote-statistics calculation)', () => {
  test('no participants: everything is empty/null', () => {
    const stats = computeVoteStats([]);
    assert.strictEqual(stats.avg, null);
    assert.strictEqual(stats.median, null);
    assert.deepStrictEqual(stats.votes, []);
    assert.deepStrictEqual(stats.dist, {});
    assert.strictEqual(stats.maxCount, 1, 'maxCount floors at 1 to avoid divide-by-zero in bar width');
  });

  test('excludes the Scrum Master and non-voters from all calculations', () => {
    const stats = computeVoteStats([
      { isMaster: true,  hasVoted: true,  vote: '999' },
      { isMaster: false, hasVoted: false, vote: null },
      { isMaster: false, hasVoted: true,  vote: '5' },
    ]);
    assert.deepStrictEqual(stats.votes, ['5']);
    assert.strictEqual(stats.avg, 5);
  });

  test('average and median for an odd number of numeric votes', () => {
    const stats = computeVoteStats([
      { isMaster: false, hasVoted: true, vote: '1' },
      { isMaster: false, hasVoted: true, vote: '3' },
      { isMaster: false, hasVoted: true, vote: '8' },
    ]);
    assert.strictEqual(stats.avg, 4);
    assert.strictEqual(stats.median, 3, 'median of [1,3,8] is the middle element');
  });

  test('median for an even number of numeric votes averages the two middle values', () => {
    const stats = computeVoteStats([
      { isMaster: false, hasVoted: true, vote: '2' },
      { isMaster: false, hasVoted: true, vote: '3' },
      { isMaster: false, hasVoted: true, vote: '5' },
      { isMaster: false, hasVoted: true, vote: '8' },
    ]);
    assert.strictEqual(stats.median, 4, '(3+5)/2 = 4');
  });

  test('non-numeric votes (❓, ☕) are excluded from avg/median but kept in nonNum and dist', () => {
    const stats = computeVoteStats([
      { isMaster: false, hasVoted: true, vote: '5' },
      { isMaster: false, hasVoted: true, vote: '❓' },
      { isMaster: false, hasVoted: true, vote: '☕' },
      { isMaster: false, hasVoted: true, vote: '❓' },
    ]);
    assert.strictEqual(stats.avg, 5, 'Only the numeric vote counts toward the average');
    assert.strictEqual(stats.median, 5);
    assert.deepStrictEqual(stats.nonNum.sort(), ['❓', '❓', '☕'].sort());
    assert.strictEqual(stats.dist['❓'], 2);
    assert.strictEqual(stats.dist['☕'], 1);
    assert.strictEqual(stats.dist['5'], 1);
  });

  test('all-non-numeric votes leave avg/median null', () => {
    const stats = computeVoteStats([
      { isMaster: false, hasVoted: true, vote: '☕' },
      { isMaster: false, hasVoted: true, vote: '☕' },
    ]);
    assert.strictEqual(stats.avg, null);
    assert.strictEqual(stats.median, null);
    assert.strictEqual(stats.dist['☕'], 2);
  });

  test('maxCount reflects the highest single-vote-value frequency for bar scaling', () => {
    const stats = computeVoteStats([
      { isMaster: false, hasVoted: true, vote: '5' },
      { isMaster: false, hasVoted: true, vote: '5' },
      { isMaster: false, hasVoted: true, vote: '5' },
      { isMaster: false, hasVoted: true, vote: '8' },
    ]);
    assert.strictEqual(stats.maxCount, 3);
    assert.strictEqual(stats.dist['5'], 3);
    assert.strictEqual(stats.dist['8'], 1);
  });
});
