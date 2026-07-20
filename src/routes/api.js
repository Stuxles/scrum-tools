/**
 * REST API routes: room info, QR code, health check, 404 catch-all.
 */

import { Router } from 'express';
import QRCode     from 'qrcode';
import { rooms }  from '../store/rooms.js';
import { PUBLIC_URL, APP_NAME } from '../config.js';
import { createRateLimiter }    from '../utils/rateLimiter.js';

const router = Router();

// ─── Health check ─────────────────────────────────────────────────────────────
// Registered before the rate limiter so Docker's HEALTHCHECK is never throttled.
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// 60 requests/minute per IP. QR generation in particular is relatively
// expensive, and the socket layer already has its own 35 events/sec limiter.
router.use(createRateLimiter({ windowMs: 60_000, max: 60 }));

// ─── Config info ──────────────────────────────────────────────────────────────
router.get('/config', (_req, res) => res.json({ appName: APP_NAME }));

// ─── Room info ────────────────────────────────────────────────────────────────
router.get('/rooms/:id', (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room niet gevonden' });
  res.json({ exists: true, name: room.name });
});

// ─── QR code ─────────────────────────────────────────────────────────────────
router.get('/rooms/:id/qr', async (req, res) => {
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
    const qr = await QRCode.toDataURL(url, { width: 280, margin: 2, color });
    res.json({ qr, url });
  } catch {
    res.status(500).json({ error: 'QR generatie mislukt' });
  }
});

export default router;
