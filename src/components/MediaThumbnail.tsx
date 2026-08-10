import type { MediaItem } from '../types';
import { mediaUrl } from '../utils/mediaUpload';

interface MediaThumbnailProps {
  item: MediaItem;
  imgClassName: string;
}

/**
 * Thumbnail for a media item.
 */
export default function MediaThumbnail({ item, imgClassName }: MediaThumbnailProps) {
  return (
    <div className="relative w-full h-full">
      <img
        src={mediaUrl(item.thumbnail_path)}
        alt={item.caption ?? ''}
        className={imgClassName}
        loading="lazy"
      />
    </div>
  );
}
