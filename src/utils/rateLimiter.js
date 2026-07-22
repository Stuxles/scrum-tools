/**
 * Minimal fixed-window rate limiter for Express routes.
 * Mirrors the per-socket limiter in src/socket/index.js but keyed by
 * `keyFn(req)` — by default the client IP, but callers can key on
 * something more specific (e.g. IP + room ID) so unrelated resources
 * don't share one budget when many distinct clients present as the same
 * IP (NAT, a shared office connection, or a reverse proxy — see
 * TRUST_PROXY in src/config.js for the latter).
 */

import { warn } from './logger.js';

const defaultKeyFn = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/**
 * @param {{ windowMs: number, max: number, keyFn?: (req: import('express').Request) => string }} opts
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter({ windowMs, max, keyFn = defaultKeyFn }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map();

  // Periodically drop expired entries so the map doesn't grow unbounded
  // under many distinct keys. unref() so it never keeps the process alive.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, windowMs);
  sweep.unref?.();

  return function rateLimiter(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      warn('rate-limit', `${key} exceeded ${max} req/${windowMs / 1000}s on ${req.method} ${req.originalUrl}`);
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Te veel verzoeken. Probeer het over een minuut opnieuw.' });
    }

    next();
  };
}
