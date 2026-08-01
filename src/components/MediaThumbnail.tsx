import type { MediaItem } from '../types';
import { mediaUrl } from '../utils/mediaUpload';
import { PlayIcon } from './icons';
import Tooltip from './Tooltip';

interface MediaThumbnailProps {
  item: MediaItem;
  imgClassName: string;
}

/**
 * Thumbnail for a media item. Video thumbnails are JPEG stills (the extracted
 * first frame), so they must be rendered with <img> — pointing a <video> at a
 * JPEG decodes nothing and renders blank — with a play badge marking videos.
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
      {item.media_type === 'video' && (
        <Tooltip label="Video">
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-on-surface/60 p-1.5">
            <PlayIcon className="w-3.5 h-3.5 text-surface" />
          </span>
        </Tooltip>
      )}
    </div>
  );
}
