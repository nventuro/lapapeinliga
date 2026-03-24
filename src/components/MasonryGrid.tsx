import type { MediaItemWithTags } from '../types';

// Tailwind needs literal class names for JIT scanning.
// These correspond to GALLERY_COLUMNS_MOBILE (2) and GALLERY_COLUMNS_SM (3) from types.ts.
const GRID_CLASSES = 'columns-2 sm:columns-3';

interface MasonryGridProps {
  items: MediaItemWithTags[];
  onItemClick: (item: MediaItemWithTags) => void;
}

export default function MasonryGrid({ items, onItemClick }: MasonryGridProps) {
  return (
    <div className={`${GRID_CLASSES} gap-2`}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onItemClick(item)}
          className="break-inside-avoid mb-2 w-full rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer block"
        >
          {item.media_type === 'video' ? (
            <video
              src={item.thumbnail_path}
              autoPlay
              loop
              muted
              playsInline
              className="w-full"
            />
          ) : (
            <img
              src={item.thumbnail_path}
              alt={item.caption ?? ''}
              className="w-full"
              loading="lazy"
            />
          )}
        </button>
      ))}
    </div>
  );
}
