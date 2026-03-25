import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/appContext';
import type { Event, MediaItemWithTags, MediaTag } from '../types';
import { useGalleryMedia } from '../hooks/useGalleryMedia';
import { supabase } from '../lib/supabase';
import { orderEvents, buildEventLabels } from '../lib/supabase';
import { PhotosIcon, UploadIcon } from './icons';
import MasonryGrid from './MasonryGrid';
import Lightbox from './Lightbox';
import MediaUploadDialog from './MediaUploadDialog';
import Tooltip from './Tooltip';
import EventSelect from './EventSelect';
import { deleteFromR2, keyFromPublicUrl } from '../utils/mediaUpload';

export default function GalleryPage() {
  const { isAdmin } = useAppContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const eventIdParam = searchParams.get('event');
  const tagsParam = searchParams.get('tags');
  const mediaIdParam = searchParams.get('media');

  const eventId = eventIdParam ? Number(eventIdParam) : null;
  const tagNames = useMemo(() => tagsParam ? tagsParam.split(',').filter(Boolean) : [], [tagsParam]);
  const openMediaId = mediaIdParam ? Number(mediaIdParam) : null;

  const { items, loading, refetch } = useGalleryMedia({ eventId, tagNames });

  const [showUpload, setShowUpload] = useState(false);

  // Fetch events for the dropdown filter
  const [events, setEvents] = useState<Event[]>([]);
  const [eventLabels, setEventLabels] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    async function fetchEvents() {
      // Fetch ascending for label building
      const { data: ascRows } = await orderEvents(
        supabase.from('events').select('*'),
        true,
      );
      if (ascRows) {
        setEventLabels(buildEventLabels(ascRows as Event[]));
        // Reverse for dropdown display (newest first)
        setEvents([...(ascRows as Event[])].reverse());
      }
    }
    fetchEvents();
  }, []);

  // Fetch all available tags
  const [allTags, setAllTags] = useState<MediaTag[]>([]);

  useEffect(() => {
    async function fetchTags() {
      const { data } = await supabase.from('media_tags').select('*').order('name');
      if (data) setAllTags(data as MediaTag[]);
    }
    fetchTags();
  }, []);

  const openItem = openMediaId ? items.find((i) => i.id === openMediaId) ?? null : null;
  const openIndex = openItem ? items.indexOf(openItem) : -1;

  function handleItemClick(item: MediaItemWithTags) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('media', String(item.id));
      return next;
    });
  }

  function closeLightbox() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('media');
      return next;
    });
  }

  function goToMedia(index: number) {
    const item = items[index];
    if (item) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('media', String(item.id));
        return next;
      });
    }
  }

  function handleEventFilter(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set('event', value);
      } else {
        next.delete('event');
      }
      next.delete('media');
      return next;
    });
  }

  function toggleTag(tagName: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const current = next.get('tags')?.split(',').filter(Boolean) ?? [];
      const updated = current.includes(tagName)
        ? current.filter((t) => t !== tagName)
        : [...current, tagName];
      if (updated.length > 0) {
        next.set('tags', updated.join(','));
      } else {
        next.delete('tags');
      }
      next.delete('media');
      return next;
    });
  }

  const handleDelete = useCallback(async () => {
    if (!openItem) return;

    // Delete from R2
    const keys = [openItem.storage_path, openItem.thumbnail_path]
      .map(keyFromPublicUrl)
      .filter((k): k is string => k !== null);
    if (keys.length > 0) {
      try { await deleteFromR2(keys); } catch { /* R2 delete is best-effort */ }
    }

    // Delete from DB
    const { error } = await supabase.from('media').delete().eq('id', openItem.id);
    if (!error) {
      closeLightbox();
      refetch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openItem, refetch]);

  const selectedEventLabel = eventId ? eventLabels.get(eventId) : null;
  const eventShortIds = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of events) map.set(e.id, e.short_id);
    return map;
  }, [events]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Galería</h2>
        </div>
        <p className="text-muted text-center py-16">Cargando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Galería</h2>
        {isAdmin && items.length > 0 && (
          <Tooltip label="Subir fotos">
            <button
              onClick={() => setShowUpload(true)}
              className="p-2 text-muted hover:text-primary transition-colors"
            >
              <UploadIcon className="w-5 h-5" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Event dropdown */}
        <EventSelect
          events={events}
          eventLabels={eventLabels}
          value={eventIdParam ?? ''}
          onChange={handleEventFilter}
        />

        {/* Tag chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const isActive = tagNames.includes(tag.name);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.name)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-on-primary'
                      : 'bg-border-subtle text-muted hover:text-muted-strong'
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Back link when filtered by event */}
        {selectedEventLabel && (
          <button
            onClick={() => navigate(`/fechas/${eventShortIds.get(eventId!) ?? eventId}`)}
            className="text-sm text-primary hover:text-primary-hover transition-colors"
          >
            ← Ir a Fecha {selectedEventLabel}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <PhotosIcon className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">Todavía no hay fotos</p>
          {isAdmin && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Subir fotos
            </button>
          )}
        </div>
      ) : (
        <MasonryGrid items={items} onItemClick={handleItemClick} />
      )}

      {openItem && (
        <Lightbox
          item={openItem}
          onClose={closeLightbox}
          onPrev={openIndex > 0 ? () => goToMedia(openIndex - 1) : null}
          onNext={openIndex < items.length - 1 ? () => goToMedia(openIndex + 1) : null}
          onDelete={isAdmin ? handleDelete : undefined}
          eventLabel={openItem.event_id ? (() => {
            const evt = events.find((e) => e.id === openItem.event_id);
            const label = eventLabels.get(openItem.event_id!) ?? '';
            return `Fecha ${label}${evt?.name ? ` — ${evt.name}` : ''}`;
          })() : null}
          onEventClick={openItem.event_id ? () => navigate(`/fechas/${eventShortIds.get(openItem.event_id!) ?? openItem.event_id}`) : undefined}
        />
      )}
      {showUpload && (
        <MediaUploadDialog
          onClose={() => setShowUpload(false)}
          onComplete={() => { setShowUpload(false); refetch(); }}
          prefilledEventId={eventId}
        />
      )}
    </div>
  );
}
