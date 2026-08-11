import type { EventWithDetails } from '../types';
import {
  EVENT_TYPE_LABELS, EXTERNAL_RESULT_LABELS, OUR_TEAM_NAME, externalMatchResult, isExternalWin,
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

      {match && result && (
        <>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <p className="font-display text-[10px] leading-relaxed tracking-wider uppercase text-celeste text-right">
              {OUR_TEAM_NAME}
            </p>
            <p className="font-display text-3xl whitespace-nowrap tabular-nums">
              {match.our_score}
              {hasPenalties && <span className="text-base text-lime"> ({match.our_penalties})</span>}
              {' — '}
              {hasPenalties && <span className="text-base text-lime">({match.their_penalties}) </span>}
              {match.their_score}
            </p>
            <p className="font-display text-[10px] leading-relaxed tracking-wider uppercase text-celeste">
              {opponentName}
            </p>
          </div>
          <p className="text-center mt-3">
            <span className={`inline-block font-display text-[10px] tracking-[0.18em] uppercase px-3 py-1 rounded-full ${
              isExternalWin(result) ? 'bg-lime text-on-lime' : 'bg-on-primary/15 text-on-primary'
            }`}>
              {EXTERNAL_RESULT_LABELS[result]}
            </span>
          </p>
        </>
      )}

      {winnerName && (
        <div className="mt-5 text-center">
          <p className="font-display text-[10px] tracking-[0.22em] text-celeste">GANADOR</p>
          <p className="font-display text-lg uppercase text-lime mt-1 flex items-center justify-center gap-1.5">
            <TrophyIcon className="w-4 h-4 shrink-0" />
            {winnerName}
          </p>
        </div>
      )}

      {event.video_key && <EventVideoSection eventId={event.id} videoKey={event.video_key} />}
    </div>
  );
}
