import { useState, useEffect, useReducer } from 'react';
import type { MediaItem, MediaItemWithTags, MediaTag } from '../types';
import { supabase } from '../lib/supabase';

interface UseGalleryMediaParams {
  eventId: number | null;
  tagNames: string[];
}

interface UseGalleryMediaResult {
  items: MediaItemWithTags[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGalleryMedia({ eventId, tagNames }: UseGalleryMediaParams): UseGalleryMediaResult {
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

      // Fetch all tag assignments + tag names for these media items
      const mediaIds = mediaRows.map((m: MediaItem) => m.id);
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('media_tag_assignments')
        .select('media_id, tag_id, media_tags(id, name)')
        .in('media_id', mediaIds);

      if (cancelled) return;

      if (assignmentError) {
        setError(assignmentError.message);
        setLoading(false);
        return;
      }

      // Build a map of media_id → tags
      const tagsByMediaId = new Map<number, MediaTag[]>();
      for (const row of assignmentRows ?? []) {
        const tag = row.media_tags as unknown as MediaTag;
        if (!tag) continue;
        const existing = tagsByMediaId.get(row.media_id) ?? [];
        existing.push(tag);
        tagsByMediaId.set(row.media_id, existing);
      }

      // Combine media + tags
      let result: MediaItemWithTags[] = mediaRows.map((m: MediaItem) => ({
        ...m,
        tags: tagsByMediaId.get(m.id) ?? [],
      }));

      // Filter by tag names (OR logic) — done client-side since the tag set is small
      if (tagNames.length > 0) {
        result = result.filter((item) =>
          item.tags.some((tag) => tagNames.includes(tag.name))
        );
      }

      setItems(result);
      setLoading(false);
    }

    doFetch();
    return () => { cancelled = true; };
  }, [eventId, tagNames, refetchCount]);

  return { items, loading, error, refetch };
}
