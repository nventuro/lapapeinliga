import type { EventWithDetails } from '../types';
import {
  EVENT_TYPE_LABELS, OUR_TEAM_NAME, externalMatchResult, isExternalWin,
} from '../types';
import { useAppContext } from '../context/appContext';
import { formatDate, formatTime } from '../utils/dateUtils';
import { EditIcon, TrophyIcon, WhatsAppIcon } from './icons';
import Tooltip from './Tooltip';
import EventVideoSection from './EventVideoSection';

interface EventHeroProps {
  event: EventWithDetails;
  eventNumber: string;
  canShare: boolean;
  onShare: () => void;
  onEdit: () => void;
}

/**
 * The navy poster that opens every event page: fecha number and type, name,
 * date/lugar/hora, the result when there is one, and the match video when the
 * event has one. Detached from the header band (canvas gutter + radius) so
 * the two navy surfaces never fuse.
 */
export default function EventHero({ event, eventNumber, canShare, onShare, onEdit }: EventHeroProps) {
  const { isAdmin, isModOrAdmin } = useAppContext();

  const match = event.type === 'external_match' ? event.externalMatch : null;
  const opponentName = event.type === 'external_match' ? event.opponent.name : null;
  const result = match
    ? externalMatchResult(match.our_score, match.their_score, match.our_penalties, match.their_penalties)
    : null;
  const hasPenalties = match != null && match.our_penalties != null && match.their_penalties != null;

  const winnerName = (event.type === 'match' || event.type === 'tournament') && event.winning_team_id != null
    ? event.teams.find((t) => t.id === event.winning_team_id)?.name ?? null
    : null;

  // The summary row needs exactly two sides; a tournament has more, so there
  // the verdict stands alone.
  const twoTeams = event.type === 'match' && event.teams.length === 2 ? event.teams : null;
  const sides = match
    ? { left: OUR_TEAM_NAME, right: opponentName }
    : twoTeams
      ? { left: twoTeams[0].name, right: twoTeams[1].name }
      : null;

  const verdict = result
    ? result === 'draw'
      ? { kind: 'draw' as const }
      : isExternalWin(result)
        ? { kind: 'winner' as const, name: OUR_TEAM_NAME, ours: true }
        : { kind: 'winner' as const, name: opponentName ?? '', ours: false }
    : winnerName
      ? { kind: 'winner' as const, name: winnerName, ours: true }
      : null;

  return (
    <div className="bg-primary pinstripes rounded-xl text-on-primary p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[11px] tracking-[0.22em] uppercase text-lime pt-1">
          Fecha #{eventNumber || '…'} · {EVENT_TYPE_LABELS[event.type]}
        </p>
        {isModOrAdmin && (
          <span className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <Tooltip label="Editar detalles">
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-1 rounded text-celeste hover:text-on-primary transition-colors"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip label={canShare ? 'Compartir por WhatsApp' : 'Completá alias/CBU para compartir'}>
              <button
                type="button"
                onClick={onShare}
                disabled={!canShare}
                className="p-1 rounded text-celeste hover:text-on-primary disabled:text-on-primary/40 disabled:cursor-not-allowed transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          </span>
        )}
      </div>

      <h2 className="text-xl font-extrabold leading-snug text-balance mt-1.5">
        {event.name ?? EVENT_TYPE_LABELS[event.type]}
      </h2>

      <p className="text-xs text-celeste mt-1.5">
        {formatDate(event.played_at)}
        {event.location && (
          <>
            {' · '}
            <a
              href={event.location.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-on-primary transition-colors"
            >
              {event.location.name}
            </a>
          </>
        )}
        {' · '}{formatTime(event.played_at_time)}
      </p>

      {sides && (
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p className="font-display text-[10px] leading-relaxed tracking-wider uppercase text-celeste text-right">
            {sides.left}
          </p>
          {match && result ? (
            <p className="font-display text-3xl whitespace-nowrap tabular-nums">
              {match.our_score}
              {hasPenalties && <span className="text-base text-lime"> ({match.our_penalties})</span>}
              {' — '}
              {hasPenalties && <span className="text-base text-lime">({match.their_penalties}) </span>}
              {match.their_score}
            </p>
          ) : (
            <p className="font-display text-base text-on-primary/60">VS</p>
          )}
          <p className="font-display text-[10px] leading-relaxed tracking-wider uppercase text-celeste">
            {sides.right}
          </p>
        </div>
      )}

      {verdict?.kind === 'draw' && (
        <p className="text-center mt-3">
          <span className="inline-block font-display text-[10px] tracking-[0.18em] uppercase px-3 py-1 rounded-full bg-on-primary/15 text-on-primary">
            Empate
          </span>
        </p>
      )}

      {verdict?.kind === 'winner' && (
        <div className={`text-center ${sides ? 'mt-3' : 'mt-5'}`}>
          <p className="font-display text-[10px] tracking-[0.22em] text-celeste">GANADOR</p>
          <p className={`font-display text-lg uppercase mt-1 flex items-center justify-center gap-1.5 ${
            verdict.ours ? 'text-lime' : 'text-on-primary/70'
          }`}>
            <TrophyIcon className="w-4 h-4 shrink-0" />
            {verdict.name}
          </p>
        </div>
      )}

      {event.video_key && <EventVideoSection eventId={event.id} videoKey={event.video_key} />}
    </div>
  );
}
