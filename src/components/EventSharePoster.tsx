import type { EventWithDetails, EventTeam, ExternalMatchPlayer, Player } from '../types';
import {
  allParticipants, compareByName, comparePlayersByGenderThenName, EVENT_TYPE_LABELS, OUR_TEAM_NAME,
} from '../types';
import { formatDateForShare, formatTime } from '../utils/dateUtils';
import { formatPesos, perPlayerCost } from '../utils/costUtils';
import crest from '../assets/crest-on-dark.png';

/**
 * The poster is laid out at phone scale so it can reuse the app's own type
 * scale and the pinstripes utility as-is, then rasterized at
 * POSTER_PIXEL_RATIO for a 1080×1350 (4:5) image — the size WhatsApp
 * previews without cropping.
 */
export const POSTER_WIDTH = 400;
export const POSTER_HEIGHT = 500;
export const POSTER_PIXEL_RATIO = 2.7;

interface EventSharePosterProps {
  event: EventWithDetails;
  eventNumber: string;
}

function PosterHeader({ event, eventNumber }: EventSharePosterProps) {
  return (
    <div className="pinstripes flex items-center gap-4 px-8 py-5">
      <img src={crest} alt="" width={64} height={63} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-display text-[11px] tracking-[0.22em] uppercase text-lime">
          Fecha #{eventNumber} · {EVENT_TYPE_LABELS[event.type]}
        </p>
        <h2 className="text-[22px] font-extrabold leading-tight mt-1">
          {event.name ?? EVENT_TYPE_LABELS[event.type]}
        </h2>
        <p className="text-[11px] text-celeste mt-1">
          {formatDateForShare(event.played_at)} · {formatTime(event.played_at_time)}
          {event.location && ` · ${event.location.name}`}
        </p>
      </div>
    </div>
  );
}

/** The navy band that closes the panels before the cost footer. It carries
    the suplentes when there are any; empty, it stays as a slim divider so
    the panels never sit directly against the lime. */
function ReservesStrip({ players }: { players: Player[] }) {
  if (players.length === 0) return <div className="pinstripes h-2.5" />;
  return (
    <p className="pinstripes text-center py-2.5 px-8">
      <span className="font-display text-[9px] tracking-[0.22em] uppercase text-celeste">Suplentes</span>
      <span className="text-[12px] font-semibold ml-2.5">
        {[...players].sort(compareByName).map((p) => p.name).join(' · ')}
      </span>
    </p>
  );
}

function CostFooter({ event }: { event: EventWithDetails }) {
  const cost = event.finances?.cost;
  const perPlayer = cost != null ? perPlayerCost(cost, allParticipants(event).length) : null;
  if (perPlayer == null) return null;
  return (
    <div className="bg-lime text-on-lime flex items-center justify-between gap-3 px-8 py-3.5">
      <p className="font-display text-[15px] uppercase whitespace-nowrap">{formatPesos(perPlayer)} por persona</p>
      {event.finances?.payee_alias_cbu && (
        <p className="text-[11px] font-semibold text-right">
          Enviar a <span className="font-extrabold">{event.finances.payee_alias_cbu}</span>
        </p>
      )}
    </div>
  );
}

/** One "player per line" list, ordered like the on-screen team cards. */
function TeamPlayerList({ players, className }: { players: Player[]; className?: string }) {
  return (
    <ul className={`text-[14px] font-semibold leading-[1.9] ${className ?? ''}`}>
      {[...players].sort(comparePlayersByGenderThenName).map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}

function ShirtTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`font-display inline-block text-[9px] tracking-[0.24em] uppercase px-2.5 py-1 rounded-full ${className ?? ''}`}>
      {children}
    </span>
  );
}

/** The match body: each panel is the shirt its team wears. */
function MatchPanels({ teams }: { teams: EventTeam[] }) {
  return (
    <div className="flex-1 grid grid-cols-2">
      {teams.map((team) => {
        const dark = team.shirt_color === 'dark';
        return (
          <div key={team.id} className={`py-5 px-4 text-center ${dark ? 'bg-shirt-dark text-on-primary' : 'bg-shirt-light text-on-surface'}`}>
            <ShirtTag className={dark ? 'bg-on-surface/40 text-on-primary/75' : 'bg-surface text-muted border border-neutral'}>
              {dark ? 'Oscuros' : 'Claros'}
            </ShirtTag>
            <p className="font-display text-[15px] uppercase mt-2.5">{team.name}</p>
            <TeamPlayerList players={team.players} className="mt-3" />
          </div>
        );
      })}
    </div>
  );
}

/** Tournament teams carry no shirt color: same ground for all, one
    full-width band per team with the players inline, at any team count.
    With no shirt to name the room, the team name takes the tag pill. */
function TournamentPanels({ teams }: { teams: EventTeam[] }) {
  return (
    <div className="flex-1 grid grid-cols-1 auto-rows-fr gap-px">
      {teams.map((team) => (
        <div key={team.id} className="bg-shirt-light text-on-surface flex flex-col items-center justify-center gap-2 py-2 px-8 text-center">
          <ShirtTag className="bg-surface text-muted border border-neutral">{team.name}</ShirtTag>
          <p className="text-[13px] font-semibold leading-snug">
            {[...team.players].sort(comparePlayersByGenderThenName).map((p) => p.name).join(' · ')}
          </p>
        </div>
      ))}
    </div>
  );
}

/** No sides on a training day: one panel holds everyone, coaches on club celeste. */
function TrainingPanels({ attendees, coaches }: { attendees: Player[]; coaches: Player[] }) {
  return (
    <>
      <div className="flex-1 bg-shirt-light text-on-surface py-6 px-8 text-center">
        <ShirtTag className="bg-surface text-muted border border-neutral">Jugadores</ShirtTag>
        <ul className="grid grid-cols-2 gap-x-8 gap-y-2 w-fit mx-auto mt-4 text-[14px] font-semibold">
          {[...attendees].sort(compareByName).map((p, i) => (
            <li key={p.id} className={i % 2 === 0 ? 'text-right' : 'text-left'}>{p.name}</li>
          ))}
        </ul>
      </div>
      {coaches.length > 0 && (
        <p className="bg-celeste text-on-celeste text-center py-2.5 px-8">
          <span className="font-display text-[9px] tracking-[0.22em] uppercase">Entrenadores</span>
          <span className="text-[12px] font-semibold ml-2.5">
            {[...coaches].sort(compareByName).map((p) => p.name).join(' · ')}
          </span>
        </p>
      )}
    </>
  );
}

/** Our half wears the club celeste; the visitors' half stays away-grey and
    holds only their name — their lineup isn't ours to publish. */
function ExternalMatchPanels({ roster, opponentName }: { roster: ExternalMatchPlayer[]; opponentName: string }) {
  return (
    <div className="flex-1 grid grid-cols-[3fr_2fr]">
      <div className="bg-celeste text-on-celeste py-5 px-6 text-center">
        <ShirtTag className="bg-primary text-on-primary">Titulares</ShirtTag>
        <TeamPlayerList players={roster.map((r) => r.player)} className="mt-3" />
      </div>
      <div className="bg-shirt-dark grid place-items-center px-2">
        <p className="font-display text-[20px] uppercase tracking-[0.08em] text-center text-on-primary/85 [writing-mode:vertical-rl]">
          {opponentName}
        </p>
      </div>
    </div>
  );
}

function VersusLine({ opponentName }: { opponentName: string }) {
  return (
    <div className="pinstripes grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-8 pb-4 -mt-1">
      <p className="font-display text-[10px] leading-relaxed tracking-wider uppercase text-celeste text-right">
        {OUR_TEAM_NAME}
      </p>
      <p className="font-display text-[15px] text-on-primary/60">VS</p>
      <p className="font-display text-[10px] leading-relaxed tracking-wider uppercase text-celeste">
        {opponentName}
      </p>
    </div>
  );
}

/** Nothing to roster on a social event: the invite is the whole poster. */
function SocialInvite({ event, eventNumber }: EventSharePosterProps) {
  return (
    <div className="pinstripes flex-1 flex flex-col items-center justify-center text-center px-10">
      <img src={crest} alt="" width={85} height={83} />
      <p className="font-display text-[11px] tracking-[0.22em] uppercase text-lime mt-5">
        Fecha #{eventNumber} · {EVENT_TYPE_LABELS[event.type]}
      </p>
      <h2 className="text-[30px] font-extrabold leading-tight text-balance mt-2">
        {event.name ?? EVENT_TYPE_LABELS[event.type]}
      </h2>
      <div className="w-10 h-0.5 bg-celeste rounded-full mt-4" />
      <p className="text-[16px] font-bold mt-4">
        {formatDateForShare(event.played_at)} · {formatTime(event.played_at_time)}
      </p>
      {event.location && <p className="text-[13px] text-celeste mt-1.5">{event.location.name}</p>}
      <p className="font-display text-[12px] tracking-[0.12em] uppercase text-lime mt-6">¡Nos vemos!</p>
    </div>
  );
}

/**
 * The fecha as a shareable image: an invite poster laid out per event type,
 * meant to be rasterized (not shown on screen). The caller mounts it
 * off-screen and captures the returned node.
 *
 * The design rule across types is "the ground you stand on says where you
 * belong": match panels are the shirt colors, tournament teams share one
 * ground, trainings put everyone in one room, and external matches face the
 * club celeste against an away grey.
 */
export default function EventSharePoster({ event, eventNumber }: EventSharePosterProps) {
  return (
    <div
      className="bg-primary text-on-primary font-sans flex flex-col overflow-hidden"
      style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}
    >
      {event.type === 'social' ? (
        <SocialInvite event={event} eventNumber={eventNumber} />
      ) : (
        <>
          <PosterHeader event={event} eventNumber={eventNumber} />
          {event.type === 'match' && <MatchPanels teams={event.teams} />}
          {event.type === 'tournament' && <TournamentPanels teams={event.teams} />}
          {event.type === 'training' && (
            <TrainingPanels attendees={event.attendees} coaches={event.coaches} />
          )}
          {event.type === 'external_match' && (
            <>
              <VersusLine opponentName={event.opponent.name} />
              <ExternalMatchPanels roster={event.roster} opponentName={event.opponent.name} />
            </>
          )}
          {(event.type === 'match' || event.type === 'tournament') && <ReservesStrip players={event.reserves} />}
          {event.type === 'external_match' && <ReservesStrip players={event.reserves.map((r) => r.player)} />}
          {event.type === 'training' && <ReservesStrip players={[]} />}
        </>
      )}
      <CostFooter event={event} />
    </div>
  );
}
