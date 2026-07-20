/**
 * Minimal per-IP fixed-window rate limiter for Express routes.
 * Mirrors the per-socket limiter in src/socket/index.js but keyed by
 * client IP instead of socket connection.
 */

/**
 * @param {{ windowMs: number, max: number }} opts
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter({ windowMs, max }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map();

  // Periodically drop expired entries so the map doesn't grow unbounded
  // under many distinct IPs. unref() so it never keeps the process alive.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, windowMs);
  sweep.unref?.();

  return function rateLimiter(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Te veel verzoeken. Probeer het over een minuut opnieuw.' });
    }

    next();
  };
}
