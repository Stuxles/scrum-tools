/**
 * Centralized configuration.
 * All environment variables and deck definitions in one place.
 */

import os from 'os';
import { APP_NAME as SHARED_APP_NAME } from '../public/js/config.js';

export const APP_NAME   = process.env.APP_NAME || SHARED_APP_NAME;
export const PORT       = Number(process.env.PORT) || 3000;
export const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : '*';

export const RECONNECT_GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes

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
