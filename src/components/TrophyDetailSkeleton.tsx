import { Link } from 'react-router-dom';
import Skeleton from './Skeleton';
import SkeletonPage from './SkeletonPage';

const WINNER_PILL_WIDTHS = ['w-24', 'w-28', 'w-20', 'w-24', 'w-32'];

/** A trophy before it loads: cover, title, date and the winners' pills. */
export default function TrophyDetailSkeleton() {
  return (
    <SkeletonPage className="space-y-6">
      <div>
        <Link to="/trofeos" className="text-sm text-muted hover:text-accent transition-colors">
          ← Trofeos
        </Link>
        <div className="relative aspect-3/2 rounded-xl overflow-hidden bg-primary pinstripes mt-3">
          <div className="absolute inset-0 cover-grade" />
        </div>
        <Skeleton className="h-7 w-3/4 mt-4 rounded" />
        <Skeleton className="h-4 w-36 mt-2 rounded" />
      </div>

      <section>
        <Skeleton className="h-3 w-32 mb-3 rounded" />
        <div className="flex flex-wrap items-center gap-1.5">
          {WINNER_PILL_WIDTHS.map((width, i) => (
            <Skeleton key={i} className={`h-7 rounded-full ${width}`} />
          ))}
        </div>
      </section>
    </SkeletonPage>
  );
}
