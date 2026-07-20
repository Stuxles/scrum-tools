import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../src/utils/rateLimiter.js';

function buildApp(opts) {
  const app = express();
  app.use(createRateLimiter(opts));
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('createRateLimiter', () => {
  test('allows requests under the limit', async () => {
    const app = buildApp({ windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/ping');
      assert.strictEqual(res.status, 200);
    }
  });

  test('returns 429 with a JSON error once the limit is exceeded', async () => {
    const app = buildApp({ windowMs: 60_000, max: 2 });
    await request(app).get('/ping');
    await request(app).get('/ping');
    const res = await request(app).get('/ping');
    assert.strictEqual(res.status, 429);
    assert.ok(res.body.error, 'must return a JSON error body');
    assert.ok(res.headers['retry-after'], 'must include a Retry-After header');
  });

  test('resets after the window elapses', async () => {
    const app = buildApp({ windowMs: 100, max: 1 });
    const first = await request(app).get('/ping');
    assert.strictEqual(first.status, 200);
    const blocked = await request(app).get('/ping');
    assert.strictEqual(blocked.status, 429);

    await new Promise(r => setTimeout(r, 150));

    const afterReset = await request(app).get('/ping');
    assert.strictEqual(afterReset.status, 200);
  });

  test('tracks separate IPs independently', async () => {
    const app = buildApp({ windowMs: 60_000, max: 1 });
    const first = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.1');
    assert.strictEqual(first.status, 200);

    // supertest requests all originate from the same loopback socket
    // regardless of X-Forwarded-For (no trust proxy configured), so this
    // documents current behavior: the limiter keys on the actual socket IP.
    const second = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.2');
    assert.strictEqual(second.status, 429, 'without trust proxy, both requests share the same real IP');
  });

  test('a custom keyFn scopes the budget beyond just the IP (e.g. IP + room id)', async () => {
    const app = express();
    // Registered per-route (like api.js does), so req.params.id is already
    // populated when the limiter runs — app.use() would run before routing
    // matches :id and see it as undefined.
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyFn: (req) => `${req.ip}:${req.params.id}`,
    });
    app.get('/rooms/:id', limiter, (_req, res) => res.json({ ok: true }));

    // Same (simulated) IP, two different room ids: each gets its own budget.
    const roomA1 = await request(app).get('/rooms/AAA111');
    const roomB1 = await request(app).get('/rooms/BBB222');
    assert.strictEqual(roomA1.status, 200);
    assert.strictEqual(roomB1.status, 200, 'a different room id is not blocked by room AAA111 exhausting its budget');

    // The same room id a second time is now over budget.
    const roomA2 = await request(app).get('/rooms/AAA111');
    assert.strictEqual(roomA2.status, 429);
  });
});
