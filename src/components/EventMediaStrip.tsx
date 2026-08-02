import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EVENT_MEDIA_PREVIEW_COUNT } from '../types';
import type { MediaItem } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useAppContext } from '../context/appContext';
import { PhotosIcon, UploadIcon } from './icons';
import MediaThumbnail from './MediaThumbnail';
import MediaUploadDialog from './MediaUploadDialog';
import Tooltip from './Tooltip';

interface EventMediaStripProps {
  eventId: number;
}

export default function EventMediaStrip({ eventId }: EventMediaStripProps) {
  const { isModOrAdmin } = useAppContext();
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);

  const { data, loading, refetch: refetchMedia } = useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('event_id', eventId)
      .order('taken_at', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw new Error(error.message);
    return data as MediaItem[];
  }, [eventId]);
  const items = data ?? [];
  // Only the FIRST load hides the strip: a refetch (e.g. after each uploaded
  // item) keeps previous data, and returning null then would unmount the open
  // MediaUploadDialog mid-batch.
  const initialLoading = loading && data === null;

  function handleItemClick(item: MediaItem) {
    navigate(`/galeria?event=${eventId}&media=${item.id}`);
  }

  if (initialLoading) return null;

  // Empty state: show upload button for admins, nothing for non-admins
  if (items.length === 0 && !isModOrAdmin) return null;

  return (
    <div className="mt-4">
      {items.length === 0 ? (
        <button
          onClick={() => setShowUpload(true)}
          className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted hover:text-accent hover:border-accent flex items-center justify-center gap-2 transition-colors"
        >
          <PhotosIcon className="w-4 h-4" />
          Subir fotos
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-muted">Fotos</h3>
            <div className="flex items-center gap-2">
              {isModOrAdmin && (
                <Tooltip label="Subir fotos">
                  <button
                    onClick={() => setShowUpload(true)}
                    className="text-muted hover:text-accent transition-colors"
                  >
                    <UploadIcon className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              <button
                onClick={() => navigate(`/galeria?event=${eventId}`)}
                className="text-xs text-accent hover:text-accent-hover transition-colors"
              >
                Ver todas ({items.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {items.slice(0, EVENT_MEDIA_PREVIEW_COUNT).map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="aspect-square rounded-lg overflow-hidden bg-border-subtle"
              >
                <MediaThumbnail item={item} imgClassName="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}

      {showUpload && (
        <MediaUploadDialog
          onClose={() => { setShowUpload(false); refetchMedia(); }}
          onItemUploaded={() => refetchMedia()}
          prefilledEventId={eventId}
        />
      )}
    </div>
  );
}
