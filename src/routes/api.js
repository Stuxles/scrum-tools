/**
 * REST API routes: room info, QR code, health check, 404 catch-all.
 */

import { Router } from 'express';
import QRCode     from 'qrcode';
import { rooms }  from '../store/rooms.js';
import {
  PUBLIC_URL, APP_NAME,
  REST_RATE_LIMIT_GLOBAL_MAX, REST_RATE_LIMIT_GLOBAL_WINDOW_MS,
  REST_RATE_LIMIT_ROOM_MAX, REST_RATE_LIMIT_ROOM_WINDOW_MS,
  QR_CODE_SIZE_PX, QR_CODE_MARGIN,
} from '../config.js';
import { createRateLimiter }    from '../utils/rateLimiter.js';

const router = Router();

// ─── Health check ─────────────────────────────────────────────────────────────
// Registered before the rate limiter so Docker's HEALTHCHECK is never throttled.
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Two layers, because many distinct users can present as a single IP (a
// shared office connection or a reverse proxy — see TRUST_PROXY):
//   1. A generous per-IP ceiling across all REST endpoints (broad abuse).
//   2. A tighter per-(IP, room) limit on the room-specific endpoints, so
//      unrelated rooms behind the same apparent IP don't share one budget,
//      while a single room/QR endpoint still can't be hammered.
router.use(createRateLimiter({ windowMs: REST_RATE_LIMIT_GLOBAL_WINDOW_MS, max: REST_RATE_LIMIT_GLOBAL_MAX }));

const roomLimiter = createRateLimiter({
  windowMs: REST_RATE_LIMIT_ROOM_WINDOW_MS,
  max: REST_RATE_LIMIT_ROOM_MAX,
  keyFn: (req) => `${req.ip || req.socket?.remoteAddress || 'unknown'}:${req.params.id}`,
});

// ─── Config info ──────────────────────────────────────────────────────────────
router.get('/config', (_req, res) => res.json({ appName: APP_NAME }));

// ─── Room info ────────────────────────────────────────────────────────────────
router.get('/rooms/:id', roomLimiter, (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room niet gevonden' });
  res.json({ exists: true, name: room.name });
});

// ─── QR code ─────────────────────────────────────────────────────────────────
router.get('/rooms/:id/qr', roomLimiter, async (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room niet gevonden' });

  const baseUrl = req.query.baseUrl
    || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host || PUBLIC_URL}`;

  const url   = `${baseUrl.replace(/\/$/, '')}/room.html?id=${room.id}`;
  const theme = req.query.theme || 'dark';
  const color = theme === 'light'
    ? { dark: '#0f172a', light: '#ffffff' }
    : { dark: '#a78bfa', light: '#0d0d1a' };

  try {
    const qr = await QRCode.toDataURL(url, { width: QR_CODE_SIZE_PX, margin: QR_CODE_MARGIN, color });
    res.json({ qr, url });
  } catch {
    res.status(500).json({ error: 'QR generatie mislukt' });
  }
});

export default router;
