import type { CSSProperties } from 'react';
import { CONFETTI_COLORS, seededRandom } from './confettiUtils';

const PIECE_COUNT = 80;

export default function ConfettiBurst() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
      {Array.from({ length: PIECE_COUNT }, (_, i) => {
        const angle = seededRandom(i, 1) * Math.PI * 2;
        const radius = 100 + seededRandom(i, 2) * 250;
        const burstX = Math.cos(angle) * radius;
        const burstY = Math.sin(angle) * radius;
        const delay = seededRandom(i, 3) * 0.4;
        const duration = 2.5 + seededRandom(i, 4) * 2;
        const width = 5 + seededRandom(i, 5) * 7;
        const height = 5 + seededRandom(i, 6) * 6;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];

        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width,
              height,
              backgroundColor: color,
              borderRadius: seededRandom(i, 7) > 0.5 ? '50%' : '2px',
              '--burst-x': `${burstX}px`,
              '--burst-y': `${burstY}px`,
              animation: `confetti-burst ${duration}s ${delay}s forwards`,
            } as CSSProperties}
          />
        );
      })}
    </div>
  );
}
