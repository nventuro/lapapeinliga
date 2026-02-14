const PIECE_COUNT = 30;

const COLORS = [
  'var(--color-gold)',
  'var(--color-gold)',
  'var(--color-primary)',
  'var(--color-confetti-pink)',
  'var(--color-confetti-green)',
];

/** Deterministic pseudo-random so confetti layout is stable across renders. */
function seeded(i: number, offset: number): number {
  const x = Math.sin(i * 127.1 + offset * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {Array.from({ length: PIECE_COUNT }, (_, i) => {
        const left = seeded(i, 1) * 100;
        const delay = seeded(i, 2) * 5;
        const duration = 3 + seeded(i, 3) * 4;
        const width = 4.5 + seeded(i, 4) * 6;
        const height = 4.5 + seeded(i, 5) * 4.5;
        const color = COLORS[i % COLORS.length];

        return (
          <div
            key={i}
            className="absolute -top-2"
            style={{
              left: `${left}%`,
              width,
              height,
              backgroundColor: color,
              animation: `confetti-fall ${duration}s ${delay}s linear infinite`,
            }}
          />
        );
      })}
    </div>
  );
}
