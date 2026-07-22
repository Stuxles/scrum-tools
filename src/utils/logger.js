/**
 * Structured, leveled, column-aligned console logging.
 *
 * Every line: `<timestamp> <LEVEL> <[tag]> <message>`, e.g.
 *   2026-07-22 11:32:31.137 INFO  [room]             E7MNGT aangemaakt door Alice SM
 *   2026-07-22 11:32:41.902 WARN  [rate-limit]       socket abc123 exceeded 35 events/sec
 *   2026-07-22 11:32:55.310 ERROR [handler:vote]     xyz789 TypeError: ...
 *
 * Level and tag are padded to a fixed width so lines line up in a
 * terminal or `docker logs`. Color is applied only when the destination
 * stream is a TTY, so piped/redirected output (log files, `docker logs`
 * without `-t` in some setups, log aggregators) never gets raw ANSI codes.
 */

const LEVEL_WIDTH = 5;   // "ERROR" is the longest level
const TAG_WIDTH    = 18; // fits "[transfer-master]"; longer tags simply overflow

const ANSI = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
};

const LEVEL_COLOR = { INFO: ANSI.cyan, WARN: ANSI.yellow, ERROR: ANSI.red };

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function formatTimestamp(date = new Date()) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const y  = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d  = pad(date.getDate());
  const h  = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s  = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
}

/**
 * @param {boolean} toStderr
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} tag
 * @param {unknown[]} args
 */
function writeLine(toStderr, level, tag, args) {
  const stream  = toStderr ? process.stderr : process.stdout;
  const useColor = Boolean(stream.isTTY);

  const timestamp = formatTimestamp();
  const levelText = level.padEnd(LEVEL_WIDTH);
  const tagText   = `[${tag}]`.padEnd(TAG_WIDTH);

  const prefix = useColor
    ? `${ANSI.dim}${timestamp}${ANSI.reset} ${LEVEL_COLOR[level]}${levelText}${ANSI.reset} ${ANSI.dim}${tagText}${ANSI.reset}`
    : `${timestamp} ${levelText} ${tagText}`;

  (toStderr ? console.error : console.log)(prefix, ...args);
}

/** @param {string} tag @param {unknown[]} args */
export function info(tag, ...args) { writeLine(false, 'INFO', tag, args); }

/** @param {string} tag @param {unknown[]} args */
export function warn(tag, ...args) { writeLine(false, 'WARN', tag, args); }

/** @param {string} tag @param {unknown[]} args */
export function error(tag, ...args) { writeLine(true, 'ERROR', tag, args); }
