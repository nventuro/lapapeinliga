import type { Player, AwardType } from '../types';
import { AWARD_TYPES, AWARD_LABELS, LEADERBOARD_MIN_DISPLAY } from '../types';
import { useAppContext } from '../context/appContext';
import { useMatchdayStats } from '../hooks/useMatchdayStats';
import { TrophyIcon, SneakerIcon, MedalIcon, UserGroupIcon, GenderMaleIcon, GenderFemaleIcon } from './icons';
import { AWARD_ICONS } from './awardIcons';
import GenderIcon from './GenderIcon';
import Tooltip from './Tooltip';

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

/** Keep full rank tiers until at least LEADERBOARD_MIN_DISPLAY players are included. */
function tierLimited<T extends { rank: number }>(ranked: T[]): T[] {
  if (ranked.length <= LEADERBOARD_MIN_DISPLAY) return ranked;

  for (let i = 0; i < ranked.length; i++) {
    const isEndOfTier = i + 1 >= ranked.length || ranked[i + 1].rank !== ranked[i].rank;
    if (isEndOfTier && i + 1 >= LEADERBOARD_MIN_DISPLAY) {
      return ranked.slice(0, i + 1);
    }
  }

  return ranked;
}

function LeaderboardSection({
  title,
  icon,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  entries: LeaderboardEntry[];
}) {
  const sorted = sortEntries([...entries]);
  const ranked = tierLimited(withRanks(sorted));

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
                    <Tooltip
                      key={award}
                      label={AWARD_LABELS[award]}
                      className="gap-0.5 rounded-full bg-gold-subtle px-2 py-1 text-sm font-medium"
                    >
                      <Icon className="w-3.5 h-3.5 text-gold" />
                      {entry.awardBreakdown[award]}
                    </Tooltip>
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

export default function StatsPage() {
  const { players } = useAppContext();
  const { gamesPlayed, gamesWon, awardCounts, matchdayParticipants, loading, error } = useMatchdayStats();

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

  // Compute average gender ratio across matchdays
  const genderRatio = (() => {
    if (matchdayParticipants.length === 0) return null;
    let totalMales = 0;
    let totalFemales = 0;
    for (const playerIds of matchdayParticipants) {
      for (const id of playerIds) {
        const player = playerMap.get(id);
        if (!player) continue;
        if (player.gender === 'male') totalMales++;
        else totalFemales++;
      }
    }
    const total = totalMales + totalFemales;
    if (total === 0) return null;
    return {
      malePercent: (totalMales / total) * 100,
      femalePercent: (totalFemales / total) * 100,
      avgMale: totalMales / matchdayParticipants.length,
      avgFemale: totalFemales / matchdayParticipants.length,
    };
  })();

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
        {/* Games played */}
        <LeaderboardSection
          title="Partidos jugados"
          icon={<SneakerIcon className="w-5 h-5 text-gold" />}
          entries={toEntries(gamesPlayed)}
        />

        {/* Games won */}
        <LeaderboardSection
          title="Partidos ganados"
          icon={<TrophyIcon className="w-5 h-5 text-gold" />}
          entries={toEntries(gamesWon)}
        />

        {/* Total awards */}
        <LeaderboardSection
          title="Premios totales"
          icon={<MedalIcon className="w-5 h-5 text-gold" />}
          entries={toBreakdownEntries(awardCounts)}
        />

        {/* Gender ratio */}
        {genderRatio && (
          <div className="border border-border rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <UserGroupIcon className="w-5 h-5 text-muted" />
              Cupo de género
            </h3>
            <div className="flex h-8 rounded-lg overflow-hidden text-sm font-medium">
              <div
                className="bg-gender-male flex items-center justify-center text-on-surface"
                style={{ width: `${genderRatio.malePercent}%` }}
              >
                {genderRatio.malePercent >= 10 && `${genderRatio.malePercent % 1 === 0 ? genderRatio.malePercent.toFixed(0) : genderRatio.malePercent.toFixed(1)}%`}
              </div>
              <div
                className="bg-gender-female flex items-center justify-center text-on-surface"
                style={{ width: `${genderRatio.femalePercent}%` }}
              >
                {genderRatio.femalePercent >= 10 && `${genderRatio.femalePercent % 1 === 0 ? genderRatio.femalePercent.toFixed(0) : genderRatio.femalePercent.toFixed(1)}%`}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-sm text-muted">
              <span className="flex items-center gap-1">
                <GenderMaleIcon className="w-4 h-4" />
                {genderRatio.avgMale.toFixed(1)} por fecha
              </span>
              <span className="flex items-center gap-1">
                <GenderFemaleIcon className="w-4 h-4" />
                {genderRatio.avgFemale.toFixed(1)} por fecha
              </span>
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}
