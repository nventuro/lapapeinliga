import { useState, useEffect, useReducer } from 'react';
import type { MediaItem, MediaItemWithTags, MediaTag, TaggedPlayer } from '../types';
import { supabase } from '../lib/supabase';

interface UseGalleryMediaParams {
  eventId: number | null;
  tagNames: string[];
  playerId: number | null;
}

interface UseGalleryMediaResult {
  items: MediaItemWithTags[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGalleryMedia({ eventId, tagNames, playerId }: UseGalleryMediaParams): UseGalleryMediaResult {
  const [items, setItems] = useState<MediaItemWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, refetch] = useReducer((c: number) => c + 1, 0);

  useEffect(() => {
    let cancelled = false;

    async function doFetch() {
      // Fetch media items
      let mediaQuery = supabase
        .from('media')
        .select('*')
        .order('taken_at', { ascending: false })
        .order('id', { ascending: false });

      if (eventId !== null) {
        mediaQuery = mediaQuery.eq('event_id', eventId);
      }

      const { data: mediaRows, error: mediaError } = await mediaQuery;
      if (cancelled) return;

      if (mediaError) {
        setError(mediaError.message);
        setLoading(false);
        return;
      }

      if (!mediaRows || mediaRows.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const mediaIds = mediaRows.map((m: MediaItem) => m.id);

      // Fetch content tag assignments and player tag assignments in parallel
      const [tagResult, playerTagResult] = await Promise.all([
        supabase
          .from('media_tag_assignments')
          .select('media_id, tag_id, media_tags(id, name)')
          .in('media_id', mediaIds),
        supabase
          .from('media_player_tags')
          .select('media_id, player_id, players(id, name)')
          .in('media_id', mediaIds),
      ]);

      if (cancelled) return;

      if (tagResult.error) {
        setError(tagResult.error.message);
        setLoading(false);
        return;
      }

      if (playerTagResult.error) {
        setError(playerTagResult.error.message);
        setLoading(false);
        return;
      }

      // Build map of media_id → content tags
      const tagsByMediaId = new Map<number, MediaTag[]>();
      for (const row of tagResult.data ?? []) {
        const tag = row.media_tags as unknown as MediaTag;
        if (!tag) continue;
        const existing = tagsByMediaId.get(row.media_id) ?? [];
        existing.push(tag);
        tagsByMediaId.set(row.media_id, existing);
      }

      // Build map of media_id → tagged players
      const playersByMediaId = new Map<number, TaggedPlayer[]>();
      for (const row of playerTagResult.data ?? []) {
        const player = row.players as unknown as TaggedPlayer;
        if (!player) continue;
        const existing = playersByMediaId.get(row.media_id) ?? [];
        existing.push(player);
        playersByMediaId.set(row.media_id, existing);
      }

      // Combine media + tags + tagged players
      let result: MediaItemWithTags[] = mediaRows.map((m: MediaItem) => ({
        ...m,
        tags: tagsByMediaId.get(m.id) ?? [],
        taggedPlayers: playersByMediaId.get(m.id) ?? [],
      }));

      // Filter by content tag names (OR logic)
      if (tagNames.length > 0) {
        result = result.filter((item) =>
          item.tags.some((tag) => tagNames.includes(tag.name))
        );
      }

      // Filter by tagged player
      if (playerId !== null) {
        result = result.filter((item) =>
          item.taggedPlayers.some((p) => p.id === playerId)
        );
      }

      setItems(result);
      setLoading(false);
    }

    doFetch();
    return () => { cancelled = true; };
  }, [eventId, tagNames, playerId, refetchCount]);

  return { items, loading, error, refetch };
}
