import type { CSSProperties } from 'react';
import { CONFETTI_COLORS, seededRandom } from './confettiUtils';

const PIECE_COUNT = 40;

export default function ConfettiBurst() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
      {Array.from({ length: PIECE_COUNT }, (_, i) => {
        const angle = seededRandom(i, 1) * Math.PI * 2;
        const radius = 80 + seededRandom(i, 2) * 180;
        const burstX = Math.cos(angle) * radius;
        const burstY = Math.sin(angle) * radius;
        const delay = seededRandom(i, 3) * 0.3;
        const duration = 2 + seededRandom(i, 4) * 2;
        const width = 5 + seededRandom(i, 5) * 6;
        const height = 5 + seededRandom(i, 6) * 5;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];

        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width,
              height,
              backgroundColor: color,
              '--burst-x': `${burstX}px`,
              '--burst-y': `${burstY}px`,
              animation: `confetti-burst ${duration}s ${delay}s ease-out forwards`,
            } as CSSProperties}
          />
        );
      })}
    </div>
  );
}
