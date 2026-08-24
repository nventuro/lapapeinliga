import { Link } from 'react-router-dom';
import Skeleton from './Skeleton';
import SkeletonPage from './SkeletonPage';
import StatTile from './StatTile';

const EVENT_ROWS = 3;

/** A player's page before the roster loads: name, record tiles, first fechas. */
export default function PlayerSkeleton() {
  return (
    <SkeletonPage className="space-y-6">
      <div>
        <Link to="/plantel" className="text-sm text-muted hover:text-accent transition-colors">
          ← Plantel
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-8 w-48 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={null} label="partidos" />
        <StatTile value={null} label="ganados" />
        <StatTile value={null} label="efectividad" accent />
      </div>

      <section>
        <Skeleton className="h-3 w-24 mb-3 rounded" />
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {Array.from({ length: EVENT_ROWS }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border-subtle last:border-b-0">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className={`h-4 rounded ${i % 2 === 0 ? 'w-1/3' : 'w-1/4'}`} />
            </div>
          ))}
        </div>
      </section>
    </SkeletonPage>
  );
}
