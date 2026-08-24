import Skeleton from './Skeleton';
import SkeletonPage from './SkeletonPage';

/** Tiles per column, in the aspect ratios phone photos come in. The third
 *  column only exists from `sm` up, like the grid it stands in for. */
const COLUMNS = [
  ['aspect-3/4', 'aspect-square', 'aspect-4/5'],
  ['aspect-square', 'aspect-3/4', 'aspect-4/3'],
  ['aspect-4/5', 'aspect-square', 'aspect-3/4'],
];

/** A photo grid before its photos load. */
export default function MasonryGridSkeleton() {
  return (
    <SkeletonPage className="flex gap-2">
      {COLUMNS.map((tiles, c) => (
        <div key={c} className={`flex-1 flex-col gap-2 ${c === COLUMNS.length - 1 ? 'hidden sm:flex' : 'flex'}`}>
          {tiles.map((aspect, i) => (
            <Skeleton key={i} className={`w-full rounded-lg ${aspect}`} />
          ))}
        </div>
      ))}
    </SkeletonPage>
  );
}
