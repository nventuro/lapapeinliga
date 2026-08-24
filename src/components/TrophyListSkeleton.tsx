import Skeleton from './Skeleton';
import SkeletonPage from './SkeletonPage';

/** A cover before its photo: the same navy ground a trophy with no photo gets,
 *  so a card is "a trophy" before it is "this trophy". */
function CoverSkeleton({ lead }: { lead: boolean }) {
  return (
    <div className={`relative rounded-xl overflow-hidden bg-primary pinstripes ${lead ? 'aspect-4/5' : 'aspect-16/10'}`}>
      <div className="absolute inset-0 cover-grade" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <Skeleton onFill className="h-3 w-40 rounded" />
        <Skeleton onFill className={`mt-2 rounded ${lead ? 'h-7 w-4/5' : 'h-5 w-2/3'}`} />
        {lead && <Skeleton onFill className="h-7 w-1/2 mt-1.5 rounded" />}
      </div>
    </div>
  );
}

/** The trophy list before it loads: the lead card, then a smaller one. */
export default function TrophyListSkeleton() {
  return (
    <SkeletonPage className="space-y-3">
      <CoverSkeleton lead />
      <CoverSkeleton lead={false} />
    </SkeletonPage>
  );
}
