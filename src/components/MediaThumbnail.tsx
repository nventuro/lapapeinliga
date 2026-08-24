import type { MediaItem } from '../types';
import { mediaUrl } from '../utils/mediaUpload';
import FadeInImage from './FadeInImage';

interface MediaThumbnailProps {
  item: MediaItem;
  imgClassName: string;
}

/**
 * Thumbnail for a media item. The tile takes the photo's own proportions
 * before the photo arrives, so a grid of them has its layout from the first
 * frame, and the photo fades in over the tile's ground.
 */
export default function MediaThumbnail({ item, imgClassName }: MediaThumbnailProps) {
  return (
    <div className="relative w-full h-full bg-neutral" style={{ aspectRatio: item.aspect_ratio }}>
      <FadeInImage
        src={mediaUrl(item.thumbnail_path)}
        alt={item.caption ?? ''}
        className={imgClassName}
        loading="lazy"
      />
    </div>
  );
}
