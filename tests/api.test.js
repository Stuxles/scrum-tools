import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import apiRouter from '../src/routes/api.js';
import { rooms, deleteRoom } from '../src/store/rooms.js';
import { APP_VERSION } from '../src/config.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);
app.get('/health', (req, res, next) => { req.url = '/health'; apiRouter(req, res, next); });

describe('REST API Routes (/api & /health)', () => {
  beforeEach(() => {
    for (const key of Object.keys(rooms)) {
      deleteRoom(key);
    }
  });

  after(() => {
    for (const key of Object.keys(rooms)) {
      deleteRoom(key);
    }
  });

  test('GET /api/config should return app name and version', async () => {
    const res = await request(app).get('/api/config');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.appName);
    assert.strictEqual(res.body.version, APP_VERSION);
    assert.match(res.body.version, /^\d+\.\d+\.\d+$/, 'version must look like semver');
  });

  test('GET /health should return ok status', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  test('GET /api/rooms/:id should return 404 if room does not exist', async () => {
    const res = await request(app).get('/api/rooms/NONEXISTENT');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Room niet gevonden');
  });

  test('GET /api/rooms/:id should return room info if room exists', async () => {
    rooms['TEST01'] = { id: 'TEST01', name: 'Sprint Planning', participants: {} };
    const res = await request(app).get('/api/rooms/TEST01');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exists, true);
    assert.strictEqual(res.body.name, 'Sprint Planning');
  });

  test('GET /api/rooms/:id/qr should return 404 if room does not exist', async () => {
    const res = await request(app).get('/api/rooms/NONEXISTENT/qr');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'Room niet gevonden');
  });

  test('GET /api/rooms/:id/qr should generate base64 QR PNG image when room exists', async () => {
    rooms['TEST02'] = { id: 'TEST02', name: 'QR Room', participants: {} };
    const res = await request(app).get('/api/rooms/TEST02/qr?baseUrl=http://localhost:3000&theme=dark');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.qr.startsWith('data:image/png;base64,'), 'Should return Base64 PNG data URL');
    assert.ok(res.body.url.includes('TEST02'));
  });
});
