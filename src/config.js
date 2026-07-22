/**
 * Centralized configuration — the single place to look for or change any
 * server-side setting: environment variables, rate limits, timers (grace
 * periods, cleanup intervals), QR code options, and deck definitions.
 * Nothing that's tunable should be hardcoded outside this file.
 */

import os from 'os';
import { APP_NAME as SHARED_APP_NAME } from '../public/js/config.js';
import pkg from '../package.json' with { type: 'json' };

export const APP_NAME    = process.env.APP_NAME || SHARED_APP_NAME;
export const APP_VERSION = pkg.version;
export const PORT       = Number(process.env.PORT) || 3000;
export const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : '*';

export const RECONNECT_GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes (empty room)

/**
 * How long a disconnected participant's seat (vote, role, spectator state)
 * is kept before being fully removed from a room. Covers brief network
 * drops — e.g. a phone locking its screen suspends the tab/connection, but
 * the person is still "in" the session and picks up where they left off
 * if they reconnect (same display name) within this window.
 * Override via PARTICIPANT_GRACE_MINUTES (minutes). Default: 10 minutes.
 */
export function parseParticipantGraceMinutes(raw) {
  const n = Number(raw);
  return n > 0 ? n : 10;
}
export const PARTICIPANT_GRACE_MS = parseParticipantGraceMinutes(process.env.PARTICIPANT_GRACE_MINUTES) * 60 * 1000;

/**
 * Express `trust proxy` setting, off by default. Set the TRUST_PROXY env var
 * when the app sits behind a reverse proxy you control (nginx, Traefik, an
 * Unraid reverse proxy, Cloudflare Tunnel) so req.ip reflects the real
 * client IP from X-Forwarded-For — otherwise every client behind that proxy
 * (e.g. a whole office) looks like one IP to the REST rate limiter.
 *
 * Only enable this when a proxy you trust is actually stripping/overwriting
 * client-supplied X-Forwarded-For headers — otherwise a client can spoof
 * its own IP and dodge rate limiting entirely.
 *
 * Accepts: 'true' (trust the immediate hop), a hop count number (e.g. '1'
 * for exactly one proxy), or an Express-recognized value like 'loopback' or
 * a specific IP/CIDR. See https://expressjs.com/en/guide/behind-proxies.html
 */
export function parseTrustProxy(raw) {
  if (!raw) return false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}
export const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
/** Per-socket event limiter (src/socket/index.js). */
export const SOCKET_RATE_LIMIT_MAX       = 35;
export const SOCKET_RATE_LIMIT_WINDOW_MS = 1000;

/** REST per-IP ceiling across all endpoints (src/routes/api.js). */
export const REST_RATE_LIMIT_GLOBAL_MAX       = 300;
export const REST_RATE_LIMIT_GLOBAL_WINDOW_MS = 60_000;

/** REST per-(IP, room) budget on room-specific endpoints (src/routes/api.js). */
export const REST_RATE_LIMIT_ROOM_MAX       = 120;
export const REST_RATE_LIMIT_ROOM_WINDOW_MS = 60_000;

// ─── Timers ───────────────────────────────────────────────────────────────────
/** How long a departed Scrum Master's role stays reserved before falling to
 *  the next participant (connectionHandlers.js). */
export const MASTER_GRACE_MS = 30 * 1000;

/** Interval at which a still-occupied room's 24h hard cleanup is re-checked
 *  and extended (utils/broadcast.js). */
export const ROOM_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ─── QR Code ──────────────────────────────────────────────────────────────────
export const QR_CODE_SIZE_PX = 280;
export const QR_CODE_MARGIN  = 2;

// ─── Deck Definitions ────────────────────────────────────────────────────────
export const DECKS = {
  standard:  ['0','1','2','3','4','5','6','8','12','16','24','32','40','♾️','❓','☕'],
  fibonacci: ['0','1','2','3','5','8','13','21','34','55','89','❓','☕'],
  tshirt:    ['XS','S','M','L','XL','XXL','❓','☕'],
};

// ─── Network ─────────────────────────────────────────────────────────────────
function detectLocalIP() {
  const ifaces    = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(ifaces)) {
    const lower     = name.toLowerCase();
    const isVirtual = lower.includes('docker')   || lower.includes('veth')
                   || lower.includes('br-')      || lower.includes('vmnet')
                   || lower.includes('vbox')     || lower.includes('hyper-v')
                   || lower.includes('tailscale');

    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) return `http://${iface.address}:${PORT}`;
        candidates.push(`http://${iface.address}:${PORT}`);
      }
    }
  }
  return candidates.length > 0 ? candidates[0] : `http://localhost:${PORT}`;
}

export const PUBLIC_URL = (process.env.PUBLIC_URL || detectLocalIP()).replace(/\/$/, '');
