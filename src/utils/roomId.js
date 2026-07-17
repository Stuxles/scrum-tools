import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a short, readable 6-character uppercase alphanumeric room ID.
 * @returns {string}
 */
export function generateRoomId() {
  return uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
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
