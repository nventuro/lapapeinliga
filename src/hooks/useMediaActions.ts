import { useCallback } from 'react';
import type { MediaItem, TaggedPlayer } from '../types';
import { supabase } from '../lib/supabase';
import { deleteFromR2, keyFromPublicUrl } from '../utils/mediaUpload';

interface UseMediaActionsResult {
  /** Removes the row and then its R2 objects. Returns false if the row survived. */
  deleteMedia: (item: MediaItem) => Promise<boolean>;
  togglePlayerTag: (mediaId: number, player: TaggedPlayer, tagged: boolean) => Promise<void>;
}

/**
 * The two writes the lightbox performs, shared by every page that opens one.
 * Both callbacks are stable, so each page decides for itself when to refetch.
 */
export function useMediaActions(): UseMediaActionsResult {
  const deleteMedia = useCallback(async (item: MediaItem): Promise<boolean> => {
    // Delete the DB row first: if it fails, nothing is lost. Deleting from R2
    // first could destroy the storage and then leave the row pointing at
    // nothing if the DB delete failed. An orphaned R2 object is harmless.
    const { error } = await supabase.from('media').delete().eq('id', item.id);
    if (error) return false;

    const keys = [item.storage_path, item.thumbnail_path]
      .map(keyFromPublicUrl)
      .filter((k): k is string => k !== null);
    if (keys.length > 0) {
      try { await deleteFromR2(keys); } catch { /* best-effort */ }
    }
    return true;
  }, []);

  const togglePlayerTag = useCallback(async (mediaId: number, player: TaggedPlayer, tagged: boolean) => {
    if (tagged) {
      await supabase.from('media_player_tags').insert({ media_id: mediaId, player_id: player.id });
    } else {
      await supabase
        .from('media_player_tags')
        .delete()
        .eq('media_id', mediaId)
        .eq('player_id', player.id);
    }
  }, []);

  return { deleteMedia, togglePlayerTag };
}
