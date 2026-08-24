import Skeleton from './Skeleton';
import SkeletonPage from './SkeletonPage';

const TEAMS = 2;
const PLAYERS_PER_TEAM = 5;

/** A fecha before it loads, in the shape of a match: the navy hero, then a
 *  card per team. The type is unknown until the row arrives, and this is the
 *  most common one. */
export default function EventDetailSkeleton() {
  return (
    <SkeletonPage>
      <div className="bg-primary pinstripes rounded-xl p-4">
        <Skeleton onFill className="h-3 w-40 mt-1 rounded" />
        <Skeleton onFill className="h-6 w-3/4 mt-3 rounded" />
        <Skeleton onFill className="h-3 w-1/2 mt-3 rounded" />
      </div>

      <div className="participant-grid mt-6">
        {Array.from({ length: TEAMS }, (_, t) => (
          <div key={t} className="bg-surface border border-border rounded-lg p-4">
            <Skeleton className="h-6 w-28 mb-3 rounded" />
            <ul className="space-y-1">
              {Array.from({ length: PLAYERS_PER_TEAM }, (_, i) => (
                <li key={i} className="flex items-center gap-2 py-1 px-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className={`h-4 rounded ${i % 2 === 0 ? 'w-1/2' : 'w-2/5'}`} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
