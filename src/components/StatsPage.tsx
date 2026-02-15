import { useState, useEffect } from 'react';
import type { Player, AwardType } from '../types';
import { AWARD_TYPES, AWARD_LABELS } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { TrophyIcon, SneakerIcon, MedalIcon } from './icons';
import { AWARD_ICONS } from './awardIcons';
import GenderIcon from './GenderIcon';

type LeaderboardEntry = {
  player: Player;
} & ({ count: number } | { awardBreakdown: Partial<Record<AwardType, number>> });

function entryTotal(entry: LeaderboardEntry): number {
  if ('count' in entry) return entry.count;
  return Object.values(entry.awardBreakdown).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** Sort by total descending, break ties alphabetically by name. */
function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.sort((a, b) => entryTotal(b) - entryTotal(a) || a.player.name.localeCompare(b.player.name));
}

/** Compute dense rank: players with the same total share the same rank number. */
function withRanks(entries: LeaderboardEntry[]): (LeaderboardEntry & { rank: number })[] {
  let rank = 0;
  let prevTotal = -1;
  return entries.map((entry) => {
    const total = entryTotal(entry);
    if (total !== prevTotal) {
      rank++;
      prevTotal = total;
    }
    return { ...entry, rank };
  });
}

function LeaderboardSection({
  title,
  icon,
  entries,
  limit,
}: {
  title: string;
  icon: React.ReactNode;
  entries: LeaderboardEntry[];
  limit?: number;
}) {
  const sorted = sortEntries([...entries]);
  const ranked = withRanks(limit ? sorted.slice(0, limit) : sorted);

  if (ranked.length === 0) return null;

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <ul className="space-y-1">
        {ranked.map((entry) => (
          <li key={entry.player.id} className="flex items-center gap-2 py-1 px-2">
            <span className="w-6 text-right text-sm text-muted font-medium">{entry.rank}.</span>
            <GenderIcon gender={entry.player.gender} />
            <span className="flex-1">{entry.player.name}</span>
            {'awardBreakdown' in entry ? (
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {AWARD_TYPES.filter((award) => entry.awardBreakdown[award]).map((award) => {
                  const Icon = AWARD_ICONS[award];
                  return (
                    <span
                      key={award}
                      className="group relative inline-flex items-center gap-0.5 rounded-full bg-gold-subtle px-2 py-1 text-sm font-medium cursor-default focus:outline-none"
                      tabIndex={0}
                    >
                      <Icon className="w-3.5 h-3.5 text-gold" />
                      {entry.awardBreakdown[award]}
                      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-on-surface text-surface text-xs px-2 py-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-10">
                        {AWARD_LABELS[award]}
                      </span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="font-medium tabular-nums">{entry.count}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const TOP_AWARDS_LIMIT = 5;

export default function StatsPage() {
  const { players } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gamesPlayed, setGamesPlayed] = useState<Map<number, number>>(new Map());
  const [gamesWon, setGamesWon] = useState<Map<number, number>>(new Map());
  const [awardCounts, setAwardCounts] = useState<Map<AwardType, Map<number, number>>>(new Map());

  useEffect(() => {
    async function fetchStats() {
      const [matchdaysResult, teamsResult, teamPlayersResult, reservesResult] = await Promise.all([
        supabase.from('matchdays').select('*'),
        supabase.from('matchday_teams').select('id, matchday_id'),
        supabase.from('matchday_team_players').select('matchday_team_id, player_id'),
        supabase.from('matchday_reserves').select('matchday_id, player_id'),
      ]);

      const queryError = matchdaysResult.error || teamsResult.error || teamPlayersResult.error || reservesResult.error;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const matchdays = matchdaysResult.data!;
      const teams = teamsResult.data!;
      const teamPlayers = teamPlayersResult.data!;
      const reserves = reservesResult.data!;

      // Build team ID → matchday ID lookup
      const teamToMatchday = new Map<number, number>();
      for (const team of teams) {
        teamToMatchday.set(team.id, team.matchday_id);
      }

      // Games played: count from team players + reserves
      const played = new Map<number, number>();
      for (const tp of teamPlayers) {
        played.set(tp.player_id, (played.get(tp.player_id) ?? 0) + 1);
      }
      for (const r of reserves) {
        played.set(r.player_id, (played.get(r.player_id) ?? 0) + 1);
      }

      // Games won: for each matchday with a winner, find players on winning team
      const won = new Map<number, number>();
      for (const matchday of matchdays) {
        if (!matchday.winning_team_id) continue;
        const winningPlayers = teamPlayers.filter((tp) => tp.matchday_team_id === matchday.winning_team_id);
        for (const wp of winningPlayers) {
          won.set(wp.player_id, (won.get(wp.player_id) ?? 0) + 1);
        }
      }

      // Awards per category
      const perCategory = new Map<AwardType, Map<number, number>>();

      for (const award of AWARD_TYPES) {
        const counts = new Map<number, number>();
        for (const matchday of matchdays) {
          const playerId = matchday[`${award}_id`] as number | null;
          if (playerId) {
            counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
          }
        }
        perCategory.set(award, counts);
      }

      setGamesPlayed(played);
      setGamesWon(won);
      setAwardCounts(perCategory);
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) {
    return <p className="text-muted text-center py-8">Cargando estadísticas...</p>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error">Error al cargar estadísticas: {error}</p>
      </div>
    );
  }

  const playerMap = new Map(players.map((p) => [p.id, p]));

  function toEntries(counts: Map<number, number>): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];
    for (const [playerId, count] of counts) {
      const player = playerMap.get(playerId);
      if (player && count > 0) {
        entries.push({ player, count });
      }
    }
    return entries;
  }

  function toBreakdownEntries(perCategory: Map<AwardType, Map<number, number>>): LeaderboardEntry[] {
    // Collect all player IDs that have at least one award
    const playerIds = new Set<number>();
    for (const counts of perCategory.values()) {
      for (const playerId of counts.keys()) {
        playerIds.add(playerId);
      }
    }

    const entries: LeaderboardEntry[] = [];
    for (const playerId of playerIds) {
      const player = playerMap.get(playerId);
      if (!player) continue;
      const breakdown: Partial<Record<AwardType, number>> = {};
      for (const award of AWARD_TYPES) {
        const count = perCategory.get(award)?.get(playerId);
        if (count) breakdown[award] = count;
      }
      entries.push({ player, awardBreakdown: breakdown });
    }
    return entries;
  }

  return (
    <div>
      <div className="space-y-4">
        {/* Total awards (top 5) */}
        <LeaderboardSection
          title="Premios totales"
          icon={<MedalIcon className="w-5 h-5 text-gold" />}
          entries={toBreakdownEntries(awardCounts)}
          limit={TOP_AWARDS_LIMIT}
        />

        {/* Awards per category */}
        {AWARD_TYPES.map((award) => {
          const Icon = AWARD_ICONS[award];
          const counts = awardCounts.get(award);
          if (!counts) return null;
          return (
            <LeaderboardSection
              key={award}
              title={AWARD_LABELS[award]}
              icon={<Icon className="w-5 h-5 text-gold" />}
              entries={toEntries(counts)}
            />
          );
        })}

        {/* Games won */}
        <LeaderboardSection
          title="Partidos ganados"
          icon={<TrophyIcon className="w-5 h-5 text-gold" />}
          entries={toEntries(gamesWon)}
        />

        {/* Games played */}
        <LeaderboardSection
          title="Partidos jugados"
          icon={<SneakerIcon className="w-5 h-5 text-gold" />}
          entries={toEntries(gamesPlayed)}
        />
      </div>
    </div>
  );
}
