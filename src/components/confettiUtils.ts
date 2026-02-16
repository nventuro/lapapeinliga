export const CONFETTI_COLORS = [
  'var(--color-gold)',
  'var(--color-gold)',
  'var(--color-primary)',
  'var(--color-confetti-pink)',
  'var(--color-confetti-green)',
];

/** Deterministic pseudo-random so confetti layout is stable across renders. */
export function seededRandom(i: number, offset: number): number {
  const x = Math.sin(i * 127.1 + offset * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
