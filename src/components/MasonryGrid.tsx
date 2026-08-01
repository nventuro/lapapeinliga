import { useMemo } from 'react';
import type { MediaItemWithTags } from '../types';
import { useWindowWidth } from '../hooks/useWindowWidth';
import MediaThumbnail from './MediaThumbnail';

/** Tailwind's `sm` breakpoint in pixels. */
const SM_BREAKPOINT = 640;
const COLUMNS_MOBILE = 2;
const COLUMNS_SM = 3;

interface MasonryGridProps {
  items: MediaItemWithTags[];
  onItemClick: (item: MediaItemWithTags) => void;
}

/**
 * Distribute items into columns using a shortest-column-first strategy.
 * Each item's height contribution is 1 / aspectRatio (since all columns
 * have equal width, relative height is inversely proportional to aspect ratio).
 */
function distributeItems(items: MediaItemWithTags[], columnCount: number): MediaItemWithTags[][] {
  const columns: MediaItemWithTags[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array<number>(columnCount).fill(0);

  for (const item of items) {
    // Find the shortest column
    let minIdx = 0;
    for (let c = 1; c < columnCount; c++) {
      if (heights[c] < heights[minIdx]) minIdx = c;
    }
    columns[minIdx].push(item);
    heights[minIdx] += 1 / item.aspect_ratio;
  }

  return columns;
}

export default function MasonryGrid({ items, onItemClick }: MasonryGridProps) {
  const width = useWindowWidth();
  const columnCount = width < SM_BREAKPOINT ? COLUMNS_MOBILE : COLUMNS_SM;

  const columns = useMemo(
    () => distributeItems(items, columnCount),
    [items, columnCount],
  );

  return (
    <div className="flex gap-2">
      {columns.map((column, colIdx) => (
        <div key={colIdx} className="flex-1 flex flex-col gap-2">
          {column.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick(item)}
              className="w-full rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer block"
            >
              <MediaThumbnail item={item} imgClassName="w-full block" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
