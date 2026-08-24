import { useCallback, useState } from 'react';
import type { MediaItemWithTags, Player, TaggedPlayer } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { useGalleryMedia } from '../hooks/useGalleryMedia';
import { useMediaActions } from '../hooks/useMediaActions';
import { PhotosIcon, UploadIcon } from './icons';
import Lightbox from './Lightbox';
import MasonryGrid from './MasonryGrid';
import MediaUploadDialog from './MediaUploadDialog';
import SectionLabel from './SectionLabel';
import Tooltip from './Tooltip';

interface TrophyGalleryProps {
  trophyId: number;
  coverMediaId: number | null;
  /** Offered first when tagging, since they are who the photos are of. */
  participants: Player[];
  onCoverChanged: () => void;
}

export default function TrophyGallery({
  trophyId, coverMediaId, participants, onCoverChanged,
}: TrophyGalleryProps) {
  const { isAdmin, isModOrAdmin, players } = useAppContext();
  const { deleteMedia, togglePlayerTag } = useMediaActions();

  const { items, loading, refetch } = useGalleryMedia({
    eventId: null, trophyId, tagNames: [], playerId: null, players,
  });

  const [openId, setOpenId] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [choosingCover, setChoosingCover] = useState(false);

  const openItem = openId !== null ? items.find((i) => i.id === openId) ?? null : null;
  const openIndex = openItem ? items.indexOf(openItem) : -1;

  const handleTogglePlayerTag = useCallback(async (player: TaggedPlayer, tagged: boolean) => {
    if (!openItem) return;
    await togglePlayerTag(openItem.id, player, tagged);
    refetch();
  }, [openItem, togglePlayerTag, refetch]);

  const handleDelete = useCallback(async () => {
    if (!openItem) return;
    if (!await deleteMedia(openItem)) return;
    setOpenId(null);
    refetch();
    // Deleting the cover clears the pointer database-side, so the trophy has
    // to be re-read or the list would keep rendering a photo that is gone.
    if (openItem.id === coverMediaId) onCoverChanged();
  }, [openItem, deleteMedia, refetch, coverMediaId, onCoverChanged]);

  async function handlePickCover(item: MediaItemWithTags) {
    setChoosingCover(false);
    const { error } = await supabase
      .from('trophies')
      .update({ cover_media_id: item.id })
      .eq('id', trophyId);
    if (!error) onCoverChanged();
  }

  if (loading) return null;

  // Whether there is a gallery at all is unknown until the photos arrive, so
  // it cannot hold its place beforehand; fading in keeps it from popping.
  if (items.length === 0) {
    if (!isModOrAdmin) return null;
    return (
      <section className="animate-fade-in motion-reduce:animate-none">
        <button
          onClick={() => setShowUpload(true)}
          className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted hover:text-accent hover:border-accent flex items-center justify-center gap-2 transition-colors"
        >
          <PhotosIcon className="w-4 h-4" />
          Subir fotos
        </button>
        {showUpload && (
          <MediaUploadDialog
            onClose={() => { setShowUpload(false); refetch(); onCoverChanged(); }}
            onItemUploaded={() => refetch()}
            trophyId={trophyId}
            tagCandidates={participants}
          />
        )}
      </section>
    );
  }

  return (
    <section className="animate-fade-in motion-reduce:animate-none">
      <div className="flex items-center justify-between">
        <SectionLabel dim>FOTOS · {items.length}</SectionLabel>
        <div className="flex items-center gap-3 mb-2">
          {isAdmin && (
            <button
              onClick={() => setChoosingCover((v) => !v)}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              {choosingCover ? 'Cancelar' : coverMediaId === null ? 'Elegir portada' : 'Cambiar portada'}
            </button>
          )}
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
        </div>
      </div>

      {choosingCover && (
        <p className="text-xs text-accent bg-accent-subtle border border-accent-border rounded-lg px-3 py-2 mb-2">
          Tocá la foto que va a ser la portada.
        </p>
      )}

      <MasonryGrid
        items={items}
        onItemClick={choosingCover ? handlePickCover : (item) => setOpenId(item.id)}
      />

      {openItem && (
        <Lightbox
          key={openItem.id}
          item={openItem}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(items[openIndex - 1].id) : null}
          onNext={openIndex < items.length - 1 ? () => setOpenId(items[openIndex + 1].id) : null}
          onDelete={isAdmin ? handleDelete : undefined}
          canEditTags={isModOrAdmin}
          tagCandidates={participants}
          allPlayers={players}
          onTogglePlayerTag={isModOrAdmin ? handleTogglePlayerTag : undefined}
        />
      )}
      {showUpload && (
        <MediaUploadDialog
          onClose={() => { setShowUpload(false); refetch(); onCoverChanged(); }}
          onItemUploaded={() => refetch()}
          trophyId={trophyId}
          tagCandidates={participants}
        />
      )}
    </section>
  );
}
