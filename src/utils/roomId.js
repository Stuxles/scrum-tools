import { randomBytes } from 'crypto';

/**
 * Crockford's Base32 alphabet: excludes I, L, O, U to avoid visual confusion
 * with 1, 1, 0, and V — and to reduce the chance of spelling awkward words.
 * https://www.crockford.com/base32.html
 */
const ROOM_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ROOM_ID_LENGTH = 6;

/**
 * Generate a short, readable 6-character room ID from a curated 32-character
 * alphabet (32 = 2^5, so `byte % 32` is perfectly uniform over a random byte
 * with no modulo bias). Crypto-random, same security properties as the
 * previous uuid-based generator, with visually ambiguous characters removed
 * and roughly 64x more combinations (32^6 vs. the old hex-only 16^6).
 * @returns {string}
 */
export function generateRoomId() {
  const bytes = randomBytes(ROOM_ID_LENGTH);
  let id = '';
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[bytes[i] % ROOM_ID_ALPHABET.length];
  }
  return id;
}

/**
 * Normalize a client-supplied room ID to the canonical stored form
 * (trimmed, uppercase). Non-string input coerces to an empty string.
 * @param {unknown} id
 * @returns {string}
 */
export function normalizeRoomId(id) {
  return String(id || '').trim().toUpperCase();
}
