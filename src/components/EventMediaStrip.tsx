import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MediaItem } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { PhotosIcon, UploadIcon } from './icons';
import MediaUploadDialog from './MediaUploadDialog';
import Tooltip from './Tooltip';

interface EventMediaStripProps {
  eventId: number;
}

export default function EventMediaStrip({ eventId }: EventMediaStripProps) {
  const { isAdmin } = useAppContext();
  const navigate = useNavigate();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    async function fetchMedia() {
      const { data } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventId)
        .order('taken_at', { ascending: false })
        .order('id', { ascending: false });
      if (data) setItems(data as MediaItem[]);
      setLoading(false);
    }
    fetchMedia();
  }, [eventId]);

  function refetchMedia() {
    supabase
      .from('media')
      .select('*')
      .eq('event_id', eventId)
      .order('taken_at', { ascending: false })
      .order('id', { ascending: false })
      .then(({ data }) => {
        if (data) setItems(data as MediaItem[]);
      });
  }

  function handleItemClick(item: MediaItem) {
    navigate(`/galeria?event=${eventId}&media=${item.id}`);
  }

  if (loading) return null;

  // Empty state: show upload button for admins, nothing for non-admins
  if (items.length === 0) {
    if (!isAdmin) return null;
    return (
      <div className="mt-4">
        <button
          onClick={() => setShowUpload(true)}
          className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted hover:text-primary hover:border-primary flex items-center justify-center gap-2 transition-colors"
        >
          <PhotosIcon className="w-4 h-4" />
          Subir fotos
        </button>
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

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-muted">Fotos</h3>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Tooltip label="Subir fotos">
              <button
                onClick={() => setShowUpload(true)}
                className="text-muted hover:text-primary transition-colors"
              >
                <UploadIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
          <button
            onClick={() => navigate(`/galeria?event=${eventId}`)}
            className="text-xs text-primary hover:text-primary-hover transition-colors"
          >
            Ver todas ({items.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            className="aspect-square rounded-lg overflow-hidden bg-border-subtle"
          >
            {item.media_type === 'video' ? (
              <video
                src={item.thumbnail_path}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={item.thumbnail_path}
                alt={item.caption ?? ''}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>

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
