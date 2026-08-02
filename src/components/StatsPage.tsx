import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Player, AwardType } from '../types';
import {
  AWARD_TYPES,
  AWARD_LABELS,
  AWARD_DESCRIPTIONS,
  EFFECTIVENESS_MIN_GAMES,
  LEADERBOARD_MIN_DISPLAY,
  LEADERBOARD_PODIUM_MAX_ROWS,
  LEADERBOARD_PODIUM_RANKS,
} from '../types';
import { useAppContext, useCurrentPlayer } from '../context/appContext';
import { useEventStats, winPercentage } from '../hooks/useEventStats';
import {
  TrophyIcon, SneakerIcon, MedalIcon, UserGroupIcon, GenderMaleIcon, GenderFemaleIcon,
  BarbellIcon, SpeakerphoneIcon, SwordsIcon, ChartBarIcon,
} from './icons';
import { AWARD_ICONS } from './awardIcons';
import GenderIcon from './GenderIcon';
import SectionLabel from './SectionLabel';
import StatTile from './StatTile';
import Tooltip from './Tooltip';

/** A count entry may override how its number reads (e.g. "73%") while still
 *  sorting on the raw value. */
type LeaderboardEntry = {
  player: Player;
} & (
  | { count: number; display?: string }
  | { awardBreakdown: Partial<Record<AwardType, number>> }
);

type RankedEntry = LeaderboardEntry & { rank: number };

const decimal = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;

function entryTotal(entry: LeaderboardEntry): number {
  if ('count' in entry) return entry.count;
  return Object.values(entry.awardBreakdown).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** Sort by total descending, break ties alphabetically by name. */
function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.sort((a, b) => entryTotal(b) - entryTotal(a) || a.player.name.localeCompare(b.player.name));
}

/** Compute dense rank: players with the same total share the same rank number. */
function withRanks(entries: LeaderboardEntry[]): RankedEntry[] {
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

/**
 * The collapsed view: whole ranks only, up to LEADERBOARD_PODIUM_RANKS of them
 * and LEADERBOARD_PODIUM_MAX_ROWS rows. The first rank is always taken, however
 * wide -- splitting a tie would rank players the data ranks equally.
 */
function podiumOf(ranked: RankedEntry[]): RankedEntry[] {
  const podium: RankedEntry[] = [];
  for (let rank = 1; rank <= LEADERBOARD_PODIUM_RANKS; rank++) {
    const tier = ranked.filter((entry) => entry.rank === rank);
    if (tier.length === 0) break;
    if (podium.length > 0 && podium.length + tier.length > LEADERBOARD_PODIUM_MAX_ROWS) break;
    podium.push(...tier);
  }
  return podium;
}

function LeaderboardRow({ entry }: { entry: RankedEntry }) {
  return (
    <li className="flex items-center gap-2 py-1 px-2">
      <span
        className={`w-6 text-right text-sm font-medium tabular-nums ${
          entry.rank === 1 ? 'text-lime-strong' : 'text-muted'
        }`}
      >
        {entry.rank}.
      </span>
      <GenderIcon gender={entry.player.gender} />
      <Link
        to={`/plantel/${entry.player.id}`}
        className="flex-1 truncate hover:text-accent transition-colors"
      >
        {entry.player.name}
      </Link>
      {'awardBreakdown' in entry ? (
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {AWARD_TYPES.filter((award) => entry.awardBreakdown[award]).map((award) => {
            const Icon = AWARD_ICONS[award];
            return (
              <Tooltip
                key={award}
                label={AWARD_LABELS[award]}
                className="gap-0.5 rounded-full bg-lime-subtle px-2 py-1 text-sm font-medium"
              >
                <Icon className="w-3.5 h-3.5 text-lime-strong" />
                {entry.awardBreakdown[award]}
              </Tooltip>
            );
          })}
        </div>
      ) : (
        <span className="font-medium tabular-nums">{entry.display ?? entry.count}</span>
      )}
    </li>
  );
}

/**
 * The ranking itself. Opens on the podium and expands to the full tier-limited
 * list on request -- eleven boards at ten rows each made the page nine screens
 * long, and the tail is worth keeping but not worth defaulting to.
 */
function LeaderboardList({ entries, footnote }: { entries: LeaderboardEntry[]; footnote?: string }) {
  const [expanded, setExpanded] = useState(false);

  const ranked = tierLimited(withRanks(sortEntries([...entries])));
  if (ranked.length === 0) return null;

  const podium = podiumOf(ranked);
  const visible = expanded ? ranked : podium;

  return (
    <>
      <ul className="space-y-1">
        {visible.map((entry) => (
          <LeaderboardRow key={entry.player.id} entry={entry} />
        ))}
      </ul>
      {footnote && <p className="text-xs text-muted mt-3 px-2">{footnote}</p>}
      {ranked.length > podium.length && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 px-2 text-sm text-accent hover:text-accent-hover transition-colors"
        >
          {expanded ? 'Ver menos' : `Ver los ${ranked.length}`}
        </button>
      )}
    </>
  );
}

function LeaderboardCard({
  title,
  description,
  icon,
  entries,
  footnote,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  entries: LeaderboardEntry[];
  footnote?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="mb-3">
        <h3 className="font-bold text-lg flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <LeaderboardList entries={entries} footnote={footnote} />
    </div>
  );
}

/** The six award categories shared one card instead of six identical ones. */
function AwardCategoryCard({ entriesFor }: { entriesFor: (award: AwardType) => LeaderboardEntry[] }) {
  const [selected, setSelected] = useState<AwardType>(AWARD_TYPES[0]);
  const Icon = AWARD_ICONS[selected];
  const entries = entriesFor(selected);

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {AWARD_TYPES.map((award) => (
          <button
            key={award}
            onClick={() => setSelected(award)}
            className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
              award === selected
                ? 'bg-primary text-on-primary'
                : 'bg-border-subtle text-muted hover:text-muted-strong'
            }`}
          >
            {AWARD_LABELS[award]}
          </button>
        ))}
      </div>
      <div className="mb-3">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Icon className="w-5 h-5 text-lime-strong" />
          {AWARD_LABELS[selected]}
        </h3>
        <p className="text-xs text-muted">{AWARD_DESCRIPTIONS[selected]}</p>
      </div>
      {entries.length > 0 ? (
        /* Remounting on category change resets the expanded state, so a board
           never opens already expanded from the previous one. */
        <LeaderboardList key={selected} entries={entries} />
      ) : (
        <p className="text-sm text-muted px-2 py-4">Todavía no se entregó este premio.</p>
      )}
    </div>
  );
}

export default function StatsPage() {
  const { players } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const {
    gamesPlayed, gamesWon, awardCounts, trainingsAttended, trainingsCoached,
    externalMatchesPlayed, eventParticipants, totalEvents, loading, error,
  } = useEventStats();

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
    if (eventParticipants.length === 0) return null;
    let totalMales = 0;
    let totalFemales = 0;
    for (const playerIds of eventParticipants) {
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
      avgMale: totalMales / eventParticipants.length,
      avgFemale: totalFemales / eventParticipants.length,
    };
  })();

  const avgTurnout = eventParticipants.length > 0
    ? eventParticipants.reduce((sum, ids) => sum + ids.length, 0) / eventParticipants.length
    : null;

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

  /** Ranked on the rounded percentage, so equal-reading rows share a rank. */
  const effectivenessEntries: LeaderboardEntry[] = [];
  for (const [playerId, played] of gamesPlayed) {
    if (played < EFFECTIVENESS_MIN_GAMES) continue;
    const player = playerMap.get(playerId);
    if (!player) continue;
    const pct = winPercentage(played, gamesWon.get(playerId) ?? 0);
    if (pct == null) continue;
    effectivenessEntries.push({ player, count: pct, display: `${pct}%` });
  }

  const myPlayed = currentPlayer ? gamesPlayed.get(currentPlayer.id) ?? 0 : 0;
  const myWon = currentPlayer ? gamesWon.get(currentPlayer.id) ?? 0 : 0;
  const myEffectiveness = winPercentage(myPlayed, myWon);

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>LA LIGA</SectionLabel>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="grid grid-cols-3 gap-2">
            <StatTile value={String(totalEvents)} label="fechas" />
            <StatTile value={String(players.length)} label="jugadores" />
            <StatTile value={avgTurnout != null ? decimal(avgTurnout) : '—'} label="por fecha" />
          </div>

          {genderRatio && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-muted mb-2 flex items-center gap-2">
                <UserGroupIcon className="w-4 h-4" />
                Cupo de género
              </h3>
              <div className="flex h-8 rounded-lg overflow-hidden text-sm font-medium">
                <div
                  className="bg-gender-male flex items-center justify-center text-on-surface"
                  style={{ width: `${genderRatio.malePercent}%` }}
                >
                  {genderRatio.malePercent >= 10 && percent(genderRatio.malePercent)}
                </div>
                <div
                  className="bg-gender-female flex items-center justify-center text-on-surface"
                  style={{ width: `${genderRatio.femalePercent}%` }}
                >
                  {genderRatio.femalePercent >= 10 && percent(genderRatio.femalePercent)}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-sm text-muted">
                <span className="flex items-center gap-1">
                  <GenderMaleIcon className="w-4 h-4" />
                  {decimal(genderRatio.avgMale)} por fecha
                </span>
                <span className="flex items-center gap-1">
                  <GenderFemaleIcon className="w-4 h-4" />
                  {decimal(genderRatio.avgFemale)} por fecha
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Only the three headline numbers and a way through -- the full record
          already lives on the player's own page. */}
      {currentPlayer && (
        <section>
          <SectionLabel>LO TUYO</SectionLabel>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="font-bold flex items-center gap-2">
              <GenderIcon gender={currentPlayer.gender} />
              <span className="min-w-0 truncate">{currentPlayer.name}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <StatTile value={String(myPlayed)} label="partidos" />
              <StatTile value={String(myWon)} label="ganados" />
              <StatTile
                value={myEffectiveness != null ? `${myEffectiveness}%` : '—'}
                label="efectividad"
                accent
              />
            </div>
            <Link
              to={`/plantel/${currentPlayer.id}`}
              className="inline-block mt-3 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Ver tu ficha →
            </Link>
          </div>
        </section>
      )}

      <section>
        <SectionLabel dim>PARTIDOS</SectionLabel>
        <div className="space-y-4">
          <LeaderboardCard
            title="Partidos jugados"
            icon={<SneakerIcon className="w-5 h-5 text-lime-strong" />}
            entries={toEntries(gamesPlayed)}
          />
          <LeaderboardCard
            title="Partidos ganados"
            icon={<TrophyIcon className="w-5 h-5 text-lime-strong" />}
            entries={toEntries(gamesWon)}
          />
          <LeaderboardCard
            title="Efectividad"
            description="Porcentaje de partidos ganados sobre jugados"
            icon={<ChartBarIcon className="w-5 h-5 text-lime-strong" />}
            entries={effectivenessEntries}
            footnote={`Entran los que jugaron al menos ${EFFECTIVENESS_MIN_GAMES} partidos.`}
          />
          <LeaderboardCard
            title="Partidos vs externos"
            description="Partidos jugados contra equipos de afuera"
            icon={<SwordsIcon className="w-5 h-5 text-lime-strong" />}
            entries={toEntries(externalMatchesPlayed)}
          />
        </div>
      </section>

      <section>
        <SectionLabel dim>PREMIOS</SectionLabel>
        <div className="space-y-4">
          <LeaderboardCard
            title="Premios totales"
            icon={<MedalIcon className="w-5 h-5 text-lime-strong" />}
            entries={toBreakdownEntries(awardCounts)}
          />
          <AwardCategoryCard entriesFor={(award) => toEntries(awardCounts.get(award) ?? new Map())} />
        </div>
      </section>

      <section>
        <SectionLabel dim>ENTRENAMIENTOS</SectionLabel>
        <div className="space-y-4">
          <LeaderboardCard
            title="Entrenamientos asistidos"
            icon={<BarbellIcon className="w-5 h-5 text-lime-strong" />}
            entries={toEntries(trainingsAttended)}
          />
          <LeaderboardCard
            title="Entrenamientos dirigidos"
            icon={<SpeakerphoneIcon className="w-5 h-5 text-lime-strong" />}
            entries={toEntries(trainingsCoached)}
          />
        </div>
      </section>
    </div>
  );
}
