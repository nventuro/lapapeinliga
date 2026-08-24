import MasonryGridSkeleton from './MasonryGridSkeleton';
import Skeleton from './Skeleton';

const TAG_CHIP_WIDTHS = ['w-16', 'w-20', 'w-14', 'w-24'];

/** The gallery before anything loads: the filter row, then the grid. */
export default function GallerySkeleton() {
  return (
    <div>
      <div className="space-y-3 mb-6">
        <Skeleton className="h-9.5 w-full rounded-lg" />
        <div className="flex flex-wrap gap-2">
          {TAG_CHIP_WIDTHS.map((width) => (
            <Skeleton key={width} className={`h-7 rounded-full ${width}`} />
          ))}
        </div>
      </div>
      <MasonryGridSkeleton />
    </div>
  );
}
