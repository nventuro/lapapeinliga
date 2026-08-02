import { useMemo } from 'react';
import type { MediaItem, MediaItemWithTags, MediaTag, TaggedPlayer, Player } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

interface UseGalleryMediaParams {
  eventId: number | null;
  /** Narrows the gallery to one trophy's photos. Applied server-side, like eventId. */
  trophyId?: number | null;
  tagNames: string[];
  playerId: number | null;
  // Public roster (players_public) used to resolve tagged-player names. The
  // players table itself is admin-only, so we never embed it here.
  players: Player[];
}

interface UseGalleryMediaResult {
  items: MediaItemWithTags[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface FetchedMedia {
  media: MediaItem[];
  tagsByMediaId: Map<number, MediaTag[]>;
  playerIdsByMediaId: Map<number, number[]>;
}

export function useGalleryMedia({ eventId, trophyId = null, tagNames, playerId, players }: UseGalleryMediaParams): UseGalleryMediaResult {
  // Only eventId/trophyId affect what the server is asked for. Tag and player
  // filters are applied client-side below, so toggling a filter chip must not
  // re-download the whole gallery.
  const { data, loading, error, refetch } = useSupabaseQuery<FetchedMedia>(async () => {
    let mediaQuery = supabase
      .from('media')
      .select('*')
      .order('taken_at', { ascending: false })
      .order('id', { ascending: false });

    if (eventId !== null) {
      mediaQuery = mediaQuery.eq('event_id', eventId);
    }
    if (trophyId !== null) {
      mediaQuery = mediaQuery.eq('trophy_id', trophyId);
    } else {
      // A photo belongs to a trophy or to the gallery, never to both: the
      // trophy page is where its photos live, and listing them here too would
      // just be the same set twice.
      mediaQuery = mediaQuery.is('trophy_id', null);
    }

    const { data: mediaRows, error: mediaError } = await mediaQuery;
    if (mediaError) throw new Error(mediaError.message);

    const media = (mediaRows ?? []) as MediaItem[];
    const tagsByMediaId = new Map<number, MediaTag[]>();
    const playerIdsByMediaId = new Map<number, number[]>();
    if (media.length === 0) return { media, tagsByMediaId, playerIdsByMediaId };

    const mediaIds = media.map((m) => m.id);
    const [tagResult, playerTagResult] = await Promise.all([
      supabase
        .from('media_tag_assignments')
        .select('media_id, tag_id, media_tags(id, name)')
        .in('media_id', mediaIds),
      supabase
        .from('media_player_tags')
        .select('media_id, player_id')
        .in('media_id', mediaIds),
    ]);
    if (tagResult.error) throw new Error(tagResult.error.message);
    if (playerTagResult.error) throw new Error(playerTagResult.error.message);

    for (const row of tagResult.data ?? []) {
      const tag = row.media_tags as unknown as MediaTag;
      if (!tag) continue;
      const existing = tagsByMediaId.get(row.media_id) ?? [];
      existing.push(tag);
      tagsByMediaId.set(row.media_id, existing);
    }

    for (const row of playerTagResult.data ?? []) {
      const existing = playerIdsByMediaId.get(row.media_id) ?? [];
      existing.push(row.player_id);
      playerIdsByMediaId.set(row.media_id, existing);
    }

    return { media, tagsByMediaId, playerIdsByMediaId };
  }, [eventId, trophyId]);

  const items = useMemo(() => {
    if (!data) return [];

    // Resolve tagged-player names from the public roster.
    const playerById = new Map(players.map((p) => [p.id, p]));
    let result: MediaItemWithTags[] = data.media.map((m) => ({
      ...m,
      tags: data.tagsByMediaId.get(m.id) ?? [],
      taggedPlayers: (data.playerIdsByMediaId.get(m.id) ?? []).flatMap((pid): TaggedPlayer[] => {
        const player = playerById.get(pid);
        return player ? [{ id: player.id, name: player.name }] : [];
      }),
    }));

    // Filter by content tag names (OR logic)
    if (tagNames.length > 0) {
      result = result.filter((item) => item.tags.some((tag) => tagNames.includes(tag.name)));
    }

    // Filter by tagged player
    if (playerId !== null) {
      result = result.filter((item) => item.taggedPlayers.some((p) => p.id === playerId));
    }

    return result;
  }, [data, players, tagNames, playerId]);

  return {
    items,
    // Only the initial load (or a query-key change) counts as loading: a
    // refetch keeps the previous items, and reporting loading then would let
    // pages unmount the open Lightbox/upload dialog mid-interaction.
    loading: loading && !data,
    error,
    refetch,
  };
}
