/* Lime is weighted double so the crest's own color leads the burst. Everything
   here is light enough to read against `canvas` -- a navy piece would look like
   a speck of dirt rather than celebration. */
export const CONFETTI_COLORS = [
  'var(--color-lime)',
  'var(--color-lime)',
  'var(--color-celeste)',
  'var(--color-confetti-pink)',
  'var(--color-confetti-amber)',
];

/** Deterministic pseudo-random so confetti layout is stable across renders. */
export function seededRandom(i: number, offset: number): number {
  const x = Math.sin(i * 127.1 + offset * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
