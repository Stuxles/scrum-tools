/**
 * The Konami code as a one-liner for callers: `onKonami(fn)`.
 *
 * Kept free of anything it unlocks, so what the code does lives at the call
 * site and this file stays a sequence matcher.
 */

const SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

const JOINED = SEQUENCE.join(' ');

/**
 * Matches on the last ten keys rather than counting progress through the
 * sequence, which is both shorter and right about the way people actually
 * type: a counter that resets on a wrong key never fires for
 * '↑↑↑↓↓←→←→ba', because the third '↑' breaks the run and nothing re-reads
 * it as a fresh start. A sliding window has no run to break.
 *
 * Pulled out of the listener so it can be tested without a DOM.
 *
 * @param {string[]} recent Keys seen so far (at most ten are kept).
 * @param {string}   key    `event.key`, single characters lower-cased.
 * @returns {{ recent: string[], complete: boolean }}
 */
export function pushKonamiKey(recent, key) {
  const next = [...recent, key].slice(-SEQUENCE.length);
  return { recent: next, complete: next.join(' ') === JOINED };
}

/**
 * @param {() => void} fn Called every time the code is entered.
 */
export function onKonami(fn) {
  if (typeof window === 'undefined') return;
  let recent = [];
  window.addEventListener('keydown', (e) => {
    const step = pushKonamiKey(recent, e.key.length === 1 ? e.key.toLowerCase() : e.key);
    recent = step.recent;
    if (step.complete) fn();
  });
}
