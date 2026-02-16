import { CONFETTI_COLORS, seededRandom } from './confettiUtils';

const PIECE_COUNT = 30;

export default function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {Array.from({ length: PIECE_COUNT }, (_, i) => {
        const left = seededRandom(i, 1) * 100;
        const delay = seededRandom(i, 2) * 5;
        const duration = 3 + seededRandom(i, 3) * 4;
        const width = 4.5 + seededRandom(i, 4) * 6;
        const height = 4.5 + seededRandom(i, 5) * 4.5;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];

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
