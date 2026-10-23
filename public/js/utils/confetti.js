/**
 * Lightweight, dependency-free falling-particle bursts for the two extremes of
 * a reveal: everyone on the same card, and everyone on a different one. Pure
 * DOM + CSS animation, no canvas/library. Respects prefers-reduced-motion
 * (skips entirely rather than a reduced variant, since these are purely
 * decorative with no information value -- the toast carries the message).
 */

const COLORS = ['#a78bfa', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#60a5fa'];
const CHAOS_EMOJI = ['🔥', '💬', '🤯', '😬', '🤷'];
const PARTICLE_COUNT = 48;
// Fewer, because a glyph is a great deal more pixels than an 8x14 rectangle.
const CHAOS_PARTICLE_COUNT = 26;
const CLEANUP_MS = 3200;

/** Unanimous vote: paper confetti. */
export function celebrateConsensus() {
  burst(PARTICLE_COUNT, (particle, i) => {
    particle.style.background = COLORS[i % COLORS.length];
  });
}

/** Every voter on a different card: it rains opinions instead of paper. */
export function celebrateChaos() {
  burst(CHAOS_PARTICLE_COUNT, (particle, i) => {
    particle.classList.add('is-emoji');
    particle.textContent = CHAOS_EMOJI[i % CHAOS_EMOJI.length];
  });
}

/**
 * @param {number} count
 * @param {(particle: HTMLElement, i: number) => void} decorate
 */
function burst(count, decorate) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.createElement('div');
  container.className = 'confetti-burst';
  container.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    particle.className = 'confetti-particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.setProperty('--delay',    `${(Math.random() * 0.4).toFixed(2)}s`);
    particle.style.setProperty('--duration', `${(1.8 + Math.random() * 1.2).toFixed(2)}s`);
    particle.style.setProperty('--drift',    `${Math.round((Math.random() - 0.5) * 160)}px`);
    particle.style.setProperty('--rotate',   `${Math.round(Math.random() * 720 - 360)}deg`);
    decorate(particle, i);
    container.appendChild(particle);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), CLEANUP_MS);
}
