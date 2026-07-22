/**
 * Lightweight, dependency-free confetti burst for celebrating a unanimous
 * vote. Pure DOM + CSS animation, no canvas/library. Respects
 * prefers-reduced-motion (skips entirely rather than a reduced variant,
 * since this is a purely decorative celebration with no information value).
 */

const COLORS = ['#a78bfa', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#60a5fa'];
const PARTICLE_COUNT = 48;
const CLEANUP_MS = 3200;

export function celebrateConsensus() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.createElement('div');
  container.className = 'confetti-burst';
  container.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const particle = document.createElement('span');
    particle.className = 'confetti-particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.setProperty('--delay',    `${(Math.random() * 0.4).toFixed(2)}s`);
    particle.style.setProperty('--duration', `${(1.8 + Math.random() * 1.2).toFixed(2)}s`);
    particle.style.setProperty('--drift',    `${Math.round((Math.random() - 0.5) * 160)}px`);
    particle.style.setProperty('--rotate',   `${Math.round(Math.random() * 720 - 360)}deg`);
    particle.style.background = COLORS[i % COLORS.length];
    container.appendChild(particle);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), CLEANUP_MS);
}
