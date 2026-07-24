/**
 * Per-session reconnect tokens.
 *
 * A token is minted server-side on the first `join-room` and handed back to
 * that client in `room-joined`. The client stores it per room and replays it
 * on every subsequent join (page refresh, tab wake-up, socket reconnect).
 *
 * This is what identifies "the same person coming back" — NOT the display
 * name. Names are user-chosen, non-unique and freely spoofable, so matching
 * on them meant two people called "Jan" collided, and anyone could take over
 * the Scrum Master role by typing the SM's name. See docs/wiki/roles.md.
 *
 * The token is a bearer secret in the same weak sense a session cookie is:
 * whoever holds it owns that seat. It is never included in `sanitizeRoom`
 * output, so it only ever travels to the one client that owns it.
 */

import { randomBytes } from 'crypto';

/** 128 bits of entropy, hex-encoded. */
const TOKEN_BYTES = 16;
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

/** @returns {string} */
export function generateSessionToken() {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Accept a client-supplied token only if it has the exact shape we mint.
 * Anything else (missing, wrong type, wrong length, `__proto__`, …) becomes
 * null, which callers treat as "no token supplied".
 *
 * @param {unknown} token
 * @returns {string|null}
 */
export function normalizeSessionToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token) ? token : null;
}
