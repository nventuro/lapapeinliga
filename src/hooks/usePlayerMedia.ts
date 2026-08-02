import type { MediaItem } from '../types';
import { PLAYER_MEDIA_PREVIEW_COUNT } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

interface UsePlayerMediaResult {
  /** Up to PLAYER_MEDIA_PREVIEW_COUNT photos, the player's own ones first. */
  photos: MediaItem[];
  /** How many photos the player is tagged in altogether. */
  total: number;
  loading: boolean;
  error: string | null;
}

const EMPTY: MediaItem[] = [];

/**
 * One player's photos for their profile. Deliberately not `useGalleryMedia`:
 * that one downloads every media row in the club and filters client-side, which
 * is right for the gallery and far too much for a page that exists once per
 * player. Videos are excluded -- a profile wants stills.
 */
export function usePlayerMedia(playerId: number | null): UsePlayerMediaResult {
  const { data, loading, error } = useSupabaseQuery(async () => {
    if (playerId == null) return { photos: EMPTY, total: 0 };

    const tagged = await supabase
      .from('media_player_tags')
      .select('media_id')
      .eq('player_id', playerId);
    if (tagged.error) throw new Error(tagged.error.message);

    const mediaIds = (tagged.data ?? []).map((row: { media_id: number }) => row.media_id);
    if (mediaIds.length === 0) return { photos: EMPTY, total: 0 };

    const [mediaResult, peopleResult] = await Promise.all([
      supabase
        .from('media')
        .select('*')
        .in('id', mediaIds)
        .eq('media_type', 'image')
        // Trophy photos are not gallery photos, and "ver todas" lands on the
        // gallery -- counting them here would promise more than that page shows.
        .is('trophy_id', null)
        .order('taken_at', { ascending: false })
        .order('id', { ascending: false }),
      // Every tag on those photos, to know how many people are in each.
      supabase.from('media_player_tags').select('media_id').in('media_id', mediaIds),
    ]);
    if (mediaResult.error) throw new Error(mediaResult.error.message);
    if (peopleResult.error) throw new Error(peopleResult.error.message);

    const peopleIn = new Map<number, number>();
    for (const row of (peopleResult.data ?? []) as { media_id: number }[]) {
      peopleIn.set(row.media_id, (peopleIn.get(row.media_id) ?? 0) + 1);
    }

    // Fewest people first, so the photos that are plainly of this player lead.
    // Sort is stable, so photos tied on head count keep the query's newest-first
    // order. Note this counts people *tagged*, not people in frame: an
    // under-tagged group shot will pass for a solo one.
    const photos = ((mediaResult.data ?? []) as MediaItem[])
      .sort((a, b) => (peopleIn.get(a.id) ?? 0) - (peopleIn.get(b.id) ?? 0));

    return { photos: photos.slice(0, PLAYER_MEDIA_PREVIEW_COUNT), total: photos.length };
  }, [playerId]);

  return {
    photos: data?.photos ?? EMPTY,
    total: data?.total ?? 0,
    loading,
    error,
  };
}
