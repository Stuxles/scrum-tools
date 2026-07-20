import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escHtml } from '../public/js/utils/helpers.js';

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
