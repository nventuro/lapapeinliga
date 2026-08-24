import Skeleton from './Skeleton';
import SkeletonPage from './SkeletonPage';

const PAST_ROWS = 4;

/** The rail down the left of a fecha card: number over type icon. */
function Rail({ className, onFill = false }: { className: string; onFill?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 px-3 border-r min-w-14 ${className}`}>
      <Skeleton onFill={onFill} className="h-3 w-5 rounded" />
      <Skeleton onFill={onFill} className="h-5 w-5 rounded-full" />
    </div>
  );
}

/** The fechas list before it loads: the next-date card, then a month of rows. */
export default function EventListSkeleton() {
  return (
    <SkeletonPage className="space-y-6">
      <section>
        <Skeleton className="h-3 w-44 mb-3 rounded" />
        <div className="flex bg-surface border border-accent-border rounded-xl overflow-hidden shadow-sm">
          <Rail className="bg-celeste border-celeste" onFill />
          <div className="flex-1 p-4 space-y-2.5">
            <Skeleton className="h-5 w-2/3 rounded" />
            <Skeleton className="h-3.5 w-5/6 rounded" />
            <div className="flex gap-1.5 pt-0.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <Skeleton className="h-3 w-20 mb-3 rounded" />
        <div className="space-y-3">
          {Array.from({ length: PAST_ROWS }, (_, i) => (
            <div key={i} className="flex bg-surface border border-border rounded-xl overflow-hidden">
              <Rail className="border-border" />
              <div className="flex-1 p-4 space-y-2">
                <Skeleton className={`h-4 rounded ${i % 2 === 0 ? 'w-1/2' : 'w-2/5'}`} />
                <Skeleton className="h-3.5 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </SkeletonPage>
  );
}
