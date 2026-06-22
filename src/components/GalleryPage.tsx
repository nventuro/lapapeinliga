import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/appContext';
import type { Event, MediaItemWithTags, MediaTag, TaggedPlayer } from '../types';
import { useGalleryMedia } from '../hooks/useGalleryMedia';
import { useEventParticipants } from '../hooks/useEventParticipants';
import { supabase } from '../lib/supabase';
import { orderEvents, buildEventLabels } from '../lib/supabase';
import { PhotosIcon, UploadIcon } from './icons';
import MasonryGrid from './MasonryGrid';
import Lightbox from './Lightbox';
import MediaUploadDialog from './MediaUploadDialog';
import Tooltip from './Tooltip';
import EventSelect from './EventSelect';
import PlayerSearchFilter from './PlayerSearchFilter';
import { deleteFromR2, keyFromPublicUrl } from '../utils/mediaUpload';

export default function GalleryPage() {
  const { isAdmin, isModOrAdmin, players: allPlayers } = useAppContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const eventIdParam = searchParams.get('event');
  const tagsParam = searchParams.get('tags');
  const mediaIdParam = searchParams.get('media');
  const playerIdParam = searchParams.get('player');

  const eventId = eventIdParam ? Number(eventIdParam) : null;
  const tagNames = useMemo(() => tagsParam ? tagsParam.split(',').filter(Boolean) : [], [tagsParam]);
  const openMediaId = mediaIdParam ? Number(mediaIdParam) : null;
  const playerId = playerIdParam ? Number(playerIdParam) : null;

  const { items, loading, refetch } = useGalleryMedia({ eventId, tagNames, playerId, players: allPlayers });

  const [showUpload, setShowUpload] = useState(false);

  // Fetch events for the dropdown filter
  const [events, setEvents] = useState<Event[]>([]);
  const [eventLabels, setEventLabels] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    async function fetchEvents() {
      const { data: ascRows } = await orderEvents(
        supabase.from('events').select('*'),
        true,
      );
      if (ascRows) {
        setEventLabels(buildEventLabels(ascRows as Event[]));
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

  // Fetch players that have at least one tagged photo (for the search filter candidates)
  const [taggedPlayerIds, setTaggedPlayerIds] = useState<Set<number>>(new Set());
  const { players } = useAppContext();

  useEffect(() => {
    async function fetchTaggedPlayers() {
      const { data } = await supabase
        .from('media_player_tags')
        .select('player_id');
      if (data) {
        setTaggedPlayerIds(new Set(data.map((r: { player_id: number }) => r.player_id)));
      }
    }
    fetchTaggedPlayers();
  }, []);

  const taggedPlayers = useMemo(
    () => players
      .filter((p) => taggedPlayerIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [players, taggedPlayerIds],
  );

  // Lightbox admin tagging: get candidates for the open item's event
  const lightboxEventId = openMediaId
    ? (items.find((i) => i.id === openMediaId)?.event_id ?? null)
    : null;
  const { participants: tagCandidates, loading: tagCandidatesLoading } = useEventParticipants(
    isModOrAdmin ? lightboxEventId : null,
  );

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

  function handlePlayerFilter(selectedPlayerId: number | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (selectedPlayerId !== null) {
        next.set('player', String(selectedPlayerId));
      } else {
        next.delete('player');
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

  // Lightbox: admin toggle player tag (auto-save)
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const handleTogglePlayerTag = useCallback(async (player: TaggedPlayer, tagged: boolean) => {
    if (!openItem) return;

    if (tagged) {
      await supabase
        .from('media_player_tags')
        .insert({ media_id: openItem.id, player_id: player.id });
    } else {
      await supabase
        .from('media_player_tags')
        .delete()
        .eq('media_id', openItem.id)
        .eq('player_id', player.id);
    }

    refetchRef.current();
  }, [openItem]);

  // Lightbox: navigate to player's filtered gallery on chip tap
  function handlePlayerClick(clickedPlayerId: number) {
    closeLightbox();
    handlePlayerFilter(clickedPlayerId);
  }

  const handleDelete = useCallback(async () => {
    if (!openItem) return;

    const keys = [openItem.storage_path, openItem.thumbnail_path]
      .map(keyFromPublicUrl)
      .filter((k): k is string => k !== null);
    if (keys.length > 0) {
      try { await deleteFromR2(keys); } catch { /* R2 delete is best-effort */ }
    }

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
        {isModOrAdmin && items.length > 0 && (
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

        {/* Player search filter */}
        {taggedPlayers.length > 0 && (
          <PlayerSearchFilter
            players={taggedPlayers}
            selectedPlayerId={playerId}
            onChange={handlePlayerFilter}
          />
        )}

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

        {/* Active filter indicators */}
        {selectedEventLabel && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(`/fechas/${eventShortIds.get(eventId!) ?? eventId}`)}
              className="text-sm text-primary hover:text-primary-hover transition-colors"
            >
              ← Ir a Fecha {selectedEventLabel}
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <PhotosIcon className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">Todavía no hay fotos</p>
          {isModOrAdmin && (
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
          key={openItem.id}
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
          onPlayerClick={handlePlayerClick}
          canEditTags={isModOrAdmin}
          tagCandidates={tagCandidates}
          allPlayers={allPlayers}
          tagCandidatesLoading={tagCandidatesLoading}
          onTogglePlayerTag={isModOrAdmin ? handleTogglePlayerTag : undefined}
        />
      )}
      {showUpload && (
        <MediaUploadDialog
          onClose={() => { setShowUpload(false); refetch(); }}
          onItemUploaded={() => refetch()}
          prefilledEventId={eventId}
        />
      )}
    </div>
  );
}
