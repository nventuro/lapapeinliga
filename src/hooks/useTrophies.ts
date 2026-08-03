import { useMemo } from 'react';
import type { MediaItem, Player, Trophy, TrophyWithDetails } from '../types';
import { compareByName } from '../types';
import { useAppContext } from '../context/appContext';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

interface FetchedTrophies {
  trophies: Trophy[];
  coverById: Map<number, MediaItem>;
  playerIdsByTrophyId: Map<number, number[]>;
}

interface UseTrophiesResult {
  trophies: TrophyWithDetails[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * The whole trophy list, newest win first, with each cover photo and each
 * participant resolved.
 *
 * Fetching all of them everywhere is deliberate: the list is a handful of rows
 * by nature, and it means the detail page, the roster profile and the list
 * itself all read the same shape from one place instead of three near-copies.
 */
export function useTrophies(): UseTrophiesResult {
  const { players } = useAppContext();

  const { data, loading, error, refetch } = useSupabaseQuery<FetchedTrophies>(async () => {
    const { data: rows, error: trophiesError } = await supabase
      .from('trophies')
      .select('id, title, description, won_at, event_id, cover_media_id')
      .order('won_at', { ascending: false })
      .order('id', { ascending: false });
    if (trophiesError) throw new Error(trophiesError.message);

    const trophies = (rows ?? []) as Trophy[];
    const coverById = new Map<number, MediaItem>();
    const playerIdsByTrophyId = new Map<number, number[]>();
    if (trophies.length === 0) return { trophies, coverById, playerIdsByTrophyId };

    const coverIds = trophies
      .map((t) => t.cover_media_id)
      .filter((id): id is number => id !== null);

    const [coverResult, participantResult] = await Promise.all([
      // `.in()` on an empty list is a valid query but a pointless round trip.
      coverIds.length > 0
        ? supabase.from('media').select('*').in('id', coverIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('trophy_participants')
        .select('trophy_id, player_id')
        .in('trophy_id', trophies.map((t) => t.id)),
    ]);
    if (coverResult.error) throw new Error(coverResult.error.message);
    if (participantResult.error) throw new Error(participantResult.error.message);

    for (const media of (coverResult.data ?? []) as MediaItem[]) {
      coverById.set(media.id, media);
    }
    for (const row of participantResult.data ?? []) {
      const existing = playerIdsByTrophyId.get(row.trophy_id) ?? [];
      existing.push(row.player_id);
      playerIdsByTrophyId.set(row.trophy_id, existing);
    }

    return { trophies, coverById, playerIdsByTrophyId };
  }, []);

  const trophies = useMemo(() => {
    if (!data) return [];
    const playerById = new Map(players.map((p) => [p.id, p]));
    return data.trophies.map((trophy): TrophyWithDetails => ({
      ...trophy,
      cover: trophy.cover_media_id !== null
        ? data.coverById.get(trophy.cover_media_id) ?? null
        : null,
      participants: (data.playerIdsByTrophyId.get(trophy.id) ?? [])
        .flatMap((id): Player[] => {
          const player = playerById.get(id);
          return player ? [player] : [];
        })
        .sort(compareByName),
    }));
  }, [data, players]);

  return {
    trophies,
    // Only the first load counts: a refetch keeps the previous list on screen
    // so an open dialog is never unmounted mid-edit.
    loading: loading && !data,
    error,
    refetch,
  };
}
