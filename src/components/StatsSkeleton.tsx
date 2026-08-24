import SectionLabel from './SectionLabel';
import Skeleton from './Skeleton';
import SkeletonPage from './SkeletonPage';
import StatTile from './StatTile';

const BOARDS = 2;
const ROWS_PER_BOARD = 5;

/** The stats page before it loads: the league tiles, then the first boards. */
export default function StatsSkeleton() {
  return (
    <SkeletonPage className="space-y-6">
      <section>
        <SectionLabel>LA LIGA</SectionLabel>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="grid grid-cols-3 gap-2">
            <StatTile value={null} label="fechas" />
            <StatTile value={null} label="jugadores" />
            <StatTile value={null} label="por fecha" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-4 w-32 mb-2 rounded" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel dim>PARTIDOS</SectionLabel>
        <div className="space-y-4">
          {Array.from({ length: BOARDS }, (_, b) => (
            <div key={b} className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-6 w-40 rounded" />
              </div>
              <ul className="space-y-1">
                {Array.from({ length: ROWS_PER_BOARD }, (_, i) => (
                  <li key={i} className="flex items-center gap-2 py-1 px-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className={`h-4 rounded ${i % 2 === 0 ? 'w-1/2' : 'w-2/5'}`} />
                    <Skeleton className="h-4 w-8 ml-auto rounded" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </SkeletonPage>
  );
}
