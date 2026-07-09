import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a short, readable 6-character uppercase alphanumeric room ID.
 * @returns {string}
 */
export function generateRoomId() {
  return uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
}
