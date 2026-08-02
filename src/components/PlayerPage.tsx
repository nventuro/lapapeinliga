import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { EventIndexRow } from '../hooks/useEventsIndex';
import {
  AWARD_TYPES,
  AWARD_LABELS,
  EVENT_TYPE_LABELS,
  PLAYER_EVENT_PREVIEW_COUNT,
} from '../types';
import { useAppContext, useCurrentPlayer } from '../context/appContext';
import { useEventStats, winPercentage } from '../hooks/useEventStats';
import { useEventsIndex } from '../hooks/useEventsIndex';
import { usePlayerMedia } from '../hooks/usePlayerMedia';
import { useTrophies } from '../hooks/useTrophies';
import { formatDateShort, formatDayMonthShort } from '../utils/dateUtils';
import { AWARD_ICONS } from './awardIcons';
import { TrophyIcon } from './icons';
import { EVENT_TYPE_ICONS } from './eventTypeIcons';
import Chip, { ChipRow } from './Chip';
import GenderIcon from './GenderIcon';
import MediaThumbnail from './MediaThumbnail';
import SectionLabel from './SectionLabel';
import StatTile from './StatTile';
import Tooltip from './Tooltip';

function PlayedEventRow({ event, label, won }: { event: EventIndexRow; label: string; won: boolean }) {
  const TypeIcon = EVENT_TYPE_ICONS[event.type];
  return (
    <Link
      to={`/fechas/${event.short_id}`}
      className="flex items-center gap-2 px-3 py-2.5 text-sm border-b border-border-subtle last:border-b-0 hover:bg-border-subtle transition-colors"
    >
      <Tooltip label={EVENT_TYPE_LABELS[event.type]}>
        <TypeIcon className="w-4 h-4 text-muted" />
      </Tooltip>
      <span className="text-xs font-semibold text-muted shrink-0">#{label}</span>
      <span className="flex-1 truncate">{event.name ?? EVENT_TYPE_LABELS[event.type]}</span>
      <span className="text-xs text-muted shrink-0">{formatDayMonthShort(event.played_at)}</span>
      {won && <Chip tone="win">Ganó</Chip>}
    </Link>
  );
}

export default function PlayerPage() {
  const { id } = useParams();
  const { players } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const [showAllEvents, setShowAllEvents] = useState(false);

  const playerId = Number(id);
  const validId = Number.isInteger(playerId);
  const player = validId ? players.find((p) => p.id === playerId) : undefined;

  const {
    gamesPlayed, gamesWon, awardCounts, trainingsAttended, trainingsCoached,
    externalMatchesPlayed, eventIdsByPlayer, wonEventIdsByPlayer, loading: statsLoading,
  } = useEventStats();
  const { events, labels } = useEventsIndex();
  const { photos, total: photoTotal } = usePlayerMedia(player ? playerId : null);
  const { trophies } = useTrophies();

  // The roster is loaded before any page renders, so a miss here is a real miss.
  if (!player) {
    return (
      <div className="text-center py-12">
        <p className="text-muted mb-4">No encontramos a ese jugador.</p>
        <Link to="/plantel" className="text-accent hover:text-accent-hover underline">
          Volver al plantel
        </Link>
      </div>
    );
  }

  const played = gamesPlayed.get(playerId) ?? 0;
  const won = gamesWon.get(playerId) ?? 0;
  const trained = trainingsAttended.get(playerId) ?? 0;
  const coached = trainingsCoached.get(playerId) ?? 0;
  const external = externalMatchesPlayed.get(playerId) ?? 0;
  const effectiveness = winPercentage(played, won);
  const isMe = currentPlayer?.id === playerId;

  // The trophy is as much theirs as the club's, so it shows on their page.
  const playerTrophies = trophies.filter((t) => t.participants.some((p) => p.id === playerId));

  const awards = AWARD_TYPES
    .map((award) => ({ award, count: awardCounts.get(award)?.get(playerId) ?? 0 }))
    .filter(({ count }) => count > 0);

  // useEventsIndex is oldest-first; the profile reads newest-first.
  const playedIds = eventIdsByPlayer.get(playerId);
  const wonIds = wonEventIdsByPlayer.get(playerId);
  const playedEvents = playedIds ? events.filter((e) => playedIds.has(e.id)).reverse() : [];
  const visibleEvents = showAllEvents ? playedEvents : playedEvents.slice(0, PLAYER_EVENT_PREVIEW_COUNT);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/plantel" className="text-sm text-muted hover:text-accent transition-colors">
          ← Plantel
        </Link>
        <h2 className="text-2xl font-bold mt-2 flex items-center gap-2">
          <GenderIcon gender={player.gender} />
          <span className="min-w-0 break-words">{player.name}</span>
          {isMe && <Chip tone="win">Vos</Chip>}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={String(played)} label="partidos" />
        <StatTile value={String(won)} label="ganados" />
        <StatTile
          value={effectiveness != null ? `${effectiveness}%` : '—'}
          label="efectividad"
          accent
        />
      </div>

      {awards.length > 0 && (
        <section>
          <SectionLabel dim>PREMIOS</SectionLabel>
          <div className="bg-surface border border-border rounded-lg p-4">
            <ChipRow className="">
              {awards.map(({ award, count }) => {
                const Icon = AWARD_ICONS[award];
                return (
                  <span
                    key={award}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full bg-lime-subtle text-on-lime"
                  >
                    <Icon className="w-3.5 h-3.5 text-lime-strong" />
                    {AWARD_LABELS[award]} ×{count}
                  </span>
                );
              })}
            </ChipRow>
          </div>
        </section>
      )}

      {playerTrophies.length > 0 && (
        <section>
          <SectionLabel dim>TROFEOS — {playerTrophies.length}</SectionLabel>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {playerTrophies.map((trophy) => (
              <Link
                key={trophy.id}
                to={`/trofeos/${trophy.id}`}
                className="flex items-center gap-2 px-3 py-2.5 text-sm border-b border-border-subtle last:border-b-0 hover:bg-border-subtle transition-colors"
              >
                <TrophyIcon className="w-4 h-4 text-lime-strong shrink-0" />
                <span className="flex-1 truncate">{trophy.title}</span>
                <span className="text-xs text-muted shrink-0">{formatDateShort(trophy.won_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(trained > 0 || coached > 0 || external > 0) && (
        <section>
          <SectionLabel dim>TAMBIÉN</SectionLabel>
          <div className="bg-surface border border-border rounded-lg p-4">
            <ChipRow className="">
              {trained > 0 && <Chip tone="neutral">{trained} entrenamiento{trained !== 1 ? 's' : ''}</Chip>}
              {coached > 0 && <Chip tone="neutral">{coached} dirigido{coached !== 1 ? 's' : ''}</Chip>}
              {external > 0 && <Chip tone="neutral">{external} vs externos</Chip>}
            </ChipRow>
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section>
          <SectionLabel dim>FOTOS</SectionLabel>
          <div className="bg-surface border border-border rounded-lg p-4">
            {/* Ordered so the photos that are plainly of this player come first.
                Bleeds to the card edges so the part-visible photo reads as
                "keep sliding" rather than as a clipped one. */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
              {photos.map((photo) => (
                <Link
                  key={photo.id}
                  to={`/galeria?player=${playerId}`}
                  className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
                >
                  <MediaThumbnail item={photo} imgClassName="w-full h-full object-cover" />
                </Link>
              ))}
            </div>
            <Link
              to={`/galeria?player=${playerId}`}
              className="inline-block mt-3 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Ver {photoTotal === 1 ? 'la foto' : `las ${photoTotal} fotos`} →
            </Link>
          </div>
        </section>
      )}

      {playedEvents.length > 0 && (
        <section>
          {/* Not "que jugó": the list covers every event they were part of,
              trainings and social ones included. */}
          <SectionLabel dim>FECHAS — {playedEvents.length}</SectionLabel>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {visibleEvents.map((event) => (
              <PlayedEventRow
                key={event.id}
                event={event}
                label={labels.get(event.id) ?? '?'}
                won={wonIds?.has(event.id) ?? false}
              />
            ))}
          </div>
          {playedEvents.length > PLAYER_EVENT_PREVIEW_COUNT && (
            <button
              onClick={() => setShowAllEvents((v) => !v)}
              className="mt-2 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              {showAllEvents ? 'Ver menos' : `Ver las ${playedEvents.length}`}
            </button>
          )}
        </section>
      )}

      {!statsLoading && played === 0 && playedEvents.length === 0 && (
        <p className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted">
          Todavía no jugó ninguna fecha.
        </p>
      )}
    </div>
  );
}
