/**
 * REST API routes: room info, QR code, health check, 404 catch-all.
 */

import { Router } from 'express';
import QRCode     from 'qrcode';
import { rooms }  from '../store/rooms.js';
import {
  PUBLIC_URL, APP_NAME, APP_VERSION,
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
router.get('/config', (_req, res) => res.json({ appName: APP_NAME, version: APP_VERSION }));

// ─── Room info ────────────────────────────────────────────────────────────────
router.get('/rooms/:id', roomLimiter, (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room niet gevonden' });
  res.json({ exists: true, name: room.name });
});

// ─── QR code ─────────────────────────────────────────────────────────────────

/**
 * Parse a value into a bare http(s) origin, or null if it isn't one.
 * Drops any path/query/hash, so nothing beyond scheme+host+port survives.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function toHttpOrigin(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Decide which origin the QR code should point at.
 *
 * `?baseUrl=` exists because the browser knows the origin it was actually
 * reached on (LAN IP, tunnel hostname, …) better than the server does. But
 * it's attacker-controllable, so it's honoured only when its host is one we
 * already trust for this request — otherwise anyone could have the server
 * mint a QR code aimed at a host of their choosing. The real client always
 * sends its own origin, so this never rejects a legitimate request.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function resolveQrOrigin(req) {
  const forwardedHost  = req.headers['x-forwarded-host'];
  const forwardedProto = req.headers['x-forwarded-proto'] || req.protocol;

  const requestOrigin =
    toHttpOrigin(`${forwardedProto}://${forwardedHost || req.headers.host || ''}`)
    || toHttpOrigin(`${req.protocol}://${req.headers.host || ''}`)
    || toHttpOrigin(PUBLIC_URL)
    || PUBLIC_URL;

  const trustedHosts = new Set(
    [requestOrigin, toHttpOrigin(PUBLIC_URL)]
      .filter(Boolean)
      .map(origin => new URL(origin).host),
  );
  if (req.headers.host) trustedHosts.add(String(req.headers.host));
  if (forwardedHost)    trustedHosts.add(String(forwardedHost));

  const requested = toHttpOrigin(req.query.baseUrl);
  if (requested && trustedHosts.has(new URL(requested).host)) return requested;

  return requestOrigin;
}

router.get('/rooms/:id/qr', roomLimiter, async (req, res) => {
  const room = rooms[req.params.id];
  if (!room) return res.status(404).json({ error: 'Room niet gevonden' });

  const url   = `${resolveQrOrigin(req).replace(/\/$/, '')}/room.html?id=${room.id}`;
  const theme = req.query.theme === 'light' ? 'light' : 'dark';
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
