/**
 * Centralized configuration.
 * All environment variables and deck definitions in one place.
 */

import os from 'os';
import { APP_NAME as SHARED_APP_NAME } from '../public/js/config.js';

export const APP_NAME   = process.env.APP_NAME || SHARED_APP_NAME;
export const PORT       = process.env.PORT       || 3000;
export const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : '*';

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
