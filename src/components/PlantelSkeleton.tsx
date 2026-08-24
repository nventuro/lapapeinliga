import Skeleton from './Skeleton';
import SkeletonPage from './SkeletonPage';

const ROWS = 8;

/** The roster before it loads: the search box, then a card of rows. */
export default function PlantelSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-9.5 w-full rounded-lg mb-3" />
      <div className="bg-surface border border-border rounded-lg p-4">
        <ul className="space-y-1">
          {Array.from({ length: ROWS }, (_, i) => (
            <li key={i} className="flex items-center gap-2 py-1 px-2 border-l-[3px] border-transparent">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex-1">
                <Skeleton className={`h-5 rounded ${i % 3 === 0 ? 'w-1/2' : i % 3 === 1 ? 'w-2/5' : 'w-1/3'}`} />
                <Skeleton className="h-3.5 w-1/3 mt-1.5 rounded" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </SkeletonPage>
  );
}
