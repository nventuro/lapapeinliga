import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConfirmAction from './ConfirmAction';
import type { EventWithDetails, MatchWithDetails, TournamentWithDetails, ExternalMatchWithDetails, Match, Training, Tournament, TournamentTeam, TournamentMatch, ExternalMatch, ExternalTeam, ExternalMatchPlayer, Player, AwardType, Location, LocationSelection, MatchTeam } from '../types';
import { allParticipants, COST_MARKUP_MULTIPLIER, isNewLocationComplete } from '../types';
import { supabase, orderEvents, buildEventLabels } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDate, formatTime, isValidTime } from '../utils/dateUtils';
import { formatPesos, perPlayerCost } from '../utils/costUtils';
import { TrophyIcon, EditIcon, WhatsAppIcon, SoccerBallIcon, BarbellIcon, ShieldIcon } from './icons';
import { buildEventShareMessage, openWhatsAppShare } from '../utils/shareMessage';
import TimeInput from './TimeInput';
import Tooltip from './Tooltip';
import BuiltTeamDisplay from './BuiltTeamDisplay';
import ConfettiBurst from './ConfettiBurst';
import LocationPicker from './LocationPicker';
import EventMediaStrip from './EventMediaStrip';
import TournamentMatchList from './TournamentMatchList';
import StandingsTable from './StandingsTable';
import TournamentTeamCard from './TournamentTeamCard';
import ResultsSection from './ResultsSection';
import ExternalMatchRoster from './ExternalMatchRoster';
import ExternalMatchScoreCard from './ExternalMatchScoreCard';
import ExternalMatchHeadToHead from './ExternalMatchHeadToHead';
import AwardsSection from './AwardsSection';
import EventFeedbackAdminSection from './EventFeedbackAdminSection';
import ReservesList from './ReservesList';
import TrainingParticipantsList from './TrainingParticipantsList';
import type { MoveDestination } from './ParticipantRow';
import { useEventAwards } from '../hooks/useEventAwards';
import { useEventFeedback } from '../hooks/useEventFeedback';

type EventPageData = {
  event: EventWithDetails;
  eventNumber: string;
};

async function fetchEventData(
  shortId: string,
  players: Player[],
): Promise<EventPageData | null> {
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('short_id', shortId)
    .single();

  if (eventError || !eventData) return null;

  const eventId = eventData.id;

  // Fetch location (nullable — not every event has a venue)
  let location: Location | null = null;
  if (eventData.location_id != null) {
    const { data: locData } = await supabase
      .from('locations')
      .select('*')
      .eq('id', eventData.location_id)
      .single();
    if (locData) location = locData as Location;
  }

  // Fetch all events for labeling
  const allEventsResult = await orderEvents(supabase.from('events').select('id, played_at'), true);
  const allRows = (allEventsResult.data ?? []) as { id: number; played_at: string }[];
  const labels = buildEventLabels(allRows);
  const eventNumber = labels.get(eventId) ?? '?';

  const playerMap = new Map(players.map((p) => [p.id, p]));

  if (eventData.type === 'match') {
    // Fetch match child
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (!matchData) return null;

    const { data: teamsData } = await supabase
      .from('match_teams')
      .select('id, match_id, name, shirt_color')
      .eq('match_id', matchData.id)
      .order('id');

    const [teamPlayersResult, reservesResult] = await Promise.all([
      supabase
        .from('match_team_players')
        .select('match_team_id, player_id')
        .in('match_team_id', (teamsData ?? []).map((t) => t.id)),
      supabase
        .from('match_reserves')
        .select('player_id')
        .eq('match_id', matchData.id),
    ]);

    const teams: MatchTeam[] = (teamsData ?? []).map((team) => ({
      ...team,
      players: (teamPlayersResult.data ?? [])
        .filter((tp) => tp.match_team_id === team.id)
        .map((tp) => playerMap.get(tp.player_id))
        .filter((p): p is Player => p !== undefined),
    }));

    const reserves = (reservesResult.data ?? [])
      .map((r) => playerMap.get(r.player_id))
      .filter((p): p is Player => p !== undefined);

    const match: Match = matchData as Match;

    return {
      event: { ...eventData, type: 'match' as const, match, teams, reserves, location } as MatchWithDetails,
      eventNumber,
    };
  } else if (eventData.type === 'tournament') {
    // Tournament
    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (!tournamentData) return null;

    const { data: teamsData } = await supabase
      .from('tournament_teams')
      .select('id, tournament_id, name')
      .eq('tournament_id', tournamentData.id)
      .order('id');

    const [teamPlayersResult, reservesResult, matchesResult] = await Promise.all([
      supabase
        .from('tournament_team_players')
        .select('tournament_team_id, player_id')
        .in('tournament_team_id', (teamsData ?? []).map((t) => t.id)),
      supabase
        .from('tournament_reserves')
        .select('player_id')
        .eq('tournament_id', tournamentData.id),
      supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentData.id)
        .order('id'),
    ]);

    const teams: TournamentTeam[] = (teamsData ?? []).map((team) => ({
      ...team,
      players: (teamPlayersResult.data ?? [])
        .filter((tp) => tp.tournament_team_id === team.id)
        .map((tp) => playerMap.get(tp.player_id))
        .filter((p): p is Player => p !== undefined),
    }));

    const reserves = (reservesResult.data ?? [])
      .map((r) => playerMap.get(r.player_id))
      .filter((p): p is Player => p !== undefined);

    const tournament: Tournament = tournamentData as Tournament;
    const tournamentMatches: TournamentMatch[] = (matchesResult.data ?? []) as TournamentMatch[];

    return {
      event: {
        ...eventData,
        type: 'tournament' as const,
        tournament,
        teams,
        reserves,
        tournamentMatches,
        location,
      } as TournamentWithDetails,
      eventNumber,
    };
  } else if (eventData.type === 'external_match') {
    // External match
    const { data: externalMatchData } = await supabase
      .from('external_matches')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (!externalMatchData) return null;

    const { data: opponentData } = await supabase
      .from('external_teams')
      .select('id, name')
      .eq('id', externalMatchData.external_team_id)
      .single();

    if (!opponentData) return null;

    const [rosterResult, reservesResult] = await Promise.all([
      supabase
        .from('external_match_players')
        .select('player_id, goals')
        .eq('external_match_id', externalMatchData.id),
      supabase
        .from('external_match_reserves')
        .select('player_id')
        .eq('external_match_id', externalMatchData.id),
    ]);

    const roster: ExternalMatchPlayer[] = (rosterResult.data ?? [])
      .map((r) => {
        const player = playerMap.get(r.player_id);
        return player ? { player, goals: r.goals } : null;
      })
      .filter((r): r is ExternalMatchPlayer => r !== null);

    const reserves = (reservesResult.data ?? [])
      .map((r) => playerMap.get(r.player_id))
      .filter((p): p is Player => p !== undefined);

    const externalMatch = externalMatchData as ExternalMatch;
    const opponent = opponentData as ExternalTeam;

    return {
      event: {
        ...eventData,
        type: 'external_match' as const,
        externalMatch,
        opponent,
        roster,
        reserves,
        location,
      } as ExternalMatchWithDetails,
      eventNumber,
    };
  } else {
    // Training
    const { data: trainingData } = await supabase
      .from('trainings')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (!trainingData) return null;

    const [attendeesResult, coachesResult] = await Promise.all([
      supabase
        .from('training_attendees')
        .select('player_id')
        .eq('training_id', trainingData.id),
      supabase
        .from('training_coaches')
        .select('player_id')
        .eq('training_id', trainingData.id),
    ]);

    const attendees = (attendeesResult.data ?? [])
      .map((a) => playerMap.get(a.player_id))
      .filter((p): p is Player => p !== undefined);

    const coaches = (coachesResult.data ?? [])
      .map((c) => playerMap.get(c.player_id))
      .filter((p): p is Player => p !== undefined);

    const training: Training = trainingData as Training;

    return {
      event: { ...eventData, type: 'training' as const, training, attendees, coaches, location },
      eventNumber,
    };
  }
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { players, isAdmin, isModOrAdmin, showCosts } = useAppContext();

  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [eventNumber, setEventNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [glowingWinner, setGlowingWinner] = useState(false);

  const awards = useEventAwards(event?.id ?? null, event?.type ?? null);
  const feedback = useEventFeedback(
    event?.id ?? null,
    event?.type ?? null,
    awards.voteWindow?.state ?? null,
    isAdmin,
  );

  // Details editing state
  const [editingDetails, setEditingDetails] = useState(false);
  const [closingDetails, setClosingDetails] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editPayee, setEditPayee] = useState('');
  const [editLocationSelection, setEditLocationSelection] = useState<LocationSelection>({ type: 'none' });
  const [allLocations, setAllLocations] = useState<Location[]>([]);

  const participants = event ? allParticipants(event) : [];

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const data = await fetchEventData(id!, players);
      if (!cancelled) {
        setEvent(data?.event ?? null);
        setEventNumber(data?.eventNumber ?? '');
        setLoading(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [id, players]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('locations').select('*').order('name').then(({ data }) => {
      if (data) setAllLocations(data as Location[]);
    });
  }, [isAdmin]);

  // Re-fetches the event payload from DB. Used after participant edits to
  // reflect the new team composition without managing per-table state.
  async function reloadEvent() {
    if (!id) return;
    const data = await fetchEventData(id, players);
    if (data) {
      setEvent(data.event);
      setEventNumber(data.eventNumber);
    }
  }

  // Wraps a single supabase mutation with saving state + error surfacing +
  // reload. The trigger that protects award integrity raises a plain
  // Postgres error; its message comes through as `error.message` here.
  async function mutate(op: () => PromiseLike<{ error: { message: string } | null }>) {
    setSaving(true);
    const { error } = await op();
    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }
    await reloadEvent();
    setSaving(false);
  }

  // For moves: always insert-then-delete so the deferred integrity trigger
  // sees the player still in event_participants at the DELETE's commit.
  async function mutateMove(
    insertOp: () => PromiseLike<{ error: { message: string } | null }>,
    deleteOp: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setSaving(true);
    const ins = await insertOp();
    if (ins.error) {
      alert(ins.error.message);
      setSaving(false);
      return;
    }
    const del = await deleteOp();
    if (del.error) {
      alert(del.error.message);
      setSaving(false);
      return;
    }
    await reloadEvent();
    setSaving(false);
  }

  const participantIds = event ? new Set(allParticipants(event).map((p) => p.id)) : new Set<number>();
  const availablePlayers = event ? players.filter((p) => !participantIds.has(p.id)) : [];

  function closeDetailsEditor() {
    setClosingDetails(true);
  }

  function handleEditorAnimationEnd() {
    if (closingDetails) {
      setEditingDetails(false);
      setClosingDetails(false);
    }
  }

  function openDetailsEditor() {
    if (!event) return;
    setEditName(event.name ?? '');
    setEditTime(event.played_at_time.slice(0, 5));
    setEditCost(event.cost != null ? String(event.cost) : '');
    setEditPayee(event.payee_alias_cbu ?? '');
    setEditLocationSelection(event.location_id != null ? { type: 'existing', locationId: event.location_id } : { type: 'none' });
    setEditingDetails(true);
  }

  async function handleSaveDetails() {
    if (!event) return;
    if (!editTime || !isValidTime(editTime)) return;
    setSaving(true);

    // Resolve location (optional)
    let locationId: number | null = null;
    let location: Location | null = null;

    if (editLocationSelection.type === 'existing') {
      locationId = editLocationSelection.locationId;
      const found = allLocations.find((l) => l.id === locationId);
      if (!found) {
        setSaving(false);
        return;
      }
      location = found;
    } else if (editLocationSelection.type === 'new') {
      if (!editLocationSelection.name.trim() || !editLocationSelection.mapsUrl.trim()) {
        setSaving(false);
        return;
      }

      const { data: newLoc, error: locError } = await supabase
        .from('locations')
        .insert({
          name: editLocationSelection.name.trim(),
          maps_url: editLocationSelection.mapsUrl.trim(),
        })
        .select('*')
        .single();

      if (locError || !newLoc) {
        setSaving(false);
        return;
      }

      const created = newLoc as Location;
      location = created;
      locationId = created.id;
      setAllLocations((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    }

    const nameValue = editName.trim() || null;
    const costValue = editCost.trim() ? parseInt(editCost.trim(), 10) : null;
    const payeeValue = editPayee.trim() || null;

    const { error } = await supabase
      .from('events')
      .update({ name: nameValue, played_at_time: editTime, location_id: locationId, cost: costValue, payee_alias_cbu: payeeValue })
      .eq('id', event.id);

    if (!error) {
      setEvent({ ...event, name: nameValue, played_at_time: editTime, location_id: locationId, location, cost: costValue, payee_alias_cbu: payeeValue });
      closeDetailsEditor();
    }
    setSaving(false);
  }

  async function handleWinnerChange(teamId: number | null) {
    if (!event || event.type !== 'match') return;
    setSaving(true);

    const { error } = await supabase
      .from('matches')
      .update({ winning_team_id: teamId })
      .eq('id', event.match.id);

    if (!error) {
      setEvent({ ...event, match: { ...event.match, winning_team_id: teamId } });
      if (teamId !== null) {
        setGlowingWinner(true);
        setTimeout(() => setGlowingWinner(false), 4000);
      }
    }
    setSaving(false);
  }

  async function handleTournamentWinnerChange(teamId: number | null) {
    if (!event || event.type !== 'tournament') return;
    setSaving(true);

    const { error } = await supabase
      .from('tournaments')
      .update({ winning_team_id: teamId })
      .eq('id', event.tournament.id);

    if (!error) {
      setEvent({ ...event, tournament: { ...event.tournament, winning_team_id: teamId } });
      if (teamId !== null) {
        setGlowingWinner(true);
        setTimeout(() => setGlowingWinner(false), 4000);
      }
    }
    setSaving(false);
  }

  async function handleExternalScoreChange(ourScore: number | null, theirScore: number | null) {
    if (!event || event.type !== 'external_match') return;
    setSaving(true);

    const { error } = await supabase
      .from('external_matches')
      .update({ our_score: ourScore, their_score: theirScore })
      .eq('id', event.externalMatch.id);

    if (!error) {
      setEvent({ ...event, externalMatch: { ...event.externalMatch, our_score: ourScore, their_score: theirScore } });
      if (ourScore != null && theirScore != null) {
        setGlowingWinner(true);
        setTimeout(() => setGlowingWinner(false), 4000);
      }
    }
    setSaving(false);
  }

  async function handleSetGoals(playerId: number, goals: number) {
    if (!event || event.type !== 'external_match') return;
    const externalMatchId = event.externalMatch.id;
    await mutate(() =>
      supabase
        .from('external_match_players')
        .update({ goals })
        .eq('external_match_id', externalMatchId)
        .eq('player_id', playerId),
    );
  }

  async function handleAddTournamentMatch(teamAId: number, teamBId: number) {
    if (!event || event.type !== 'tournament') return;
    setSaving(true);

    const { data, error } = await supabase
      .from('tournament_matches')
      .insert({ tournament_id: event.tournament.id, team_a_id: teamAId, team_b_id: teamBId })
      .select('*')
      .single();

    if (!error && data) {
      const newMatch = data as TournamentMatch;
      setEvent({ ...event, tournamentMatches: [...event.tournamentMatches, newMatch] });
    }
    setSaving(false);
  }

  async function handleUpdateTournamentMatchScore(matchId: number, scoreA: number | null, scoreB: number | null) {
    if (!event || event.type !== 'tournament') return;
    setSaving(true);

    const { error } = await supabase
      .from('tournament_matches')
      .update({ score_a: scoreA, score_b: scoreB })
      .eq('id', matchId);

    if (!error) {
      setEvent({
        ...event,
        tournamentMatches: event.tournamentMatches.map((m) =>
          m.id === matchId ? { ...m, score_a: scoreA, score_b: scoreB } : m,
        ),
      });
    }
    setSaving(false);
  }

  async function handleDeleteTournamentMatch(matchId: number) {
    if (!event || event.type !== 'tournament') return;
    setSaving(true);

    const { error } = await supabase
      .from('tournament_matches')
      .delete()
      .eq('id', matchId);

    if (!error) {
      setEvent({
        ...event,
        tournamentMatches: event.tournamentMatches.filter((m) => m.id !== matchId),
      });
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!event) return;

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', event.id);

    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }

    navigate('/fechas');
  }

  if (loading) {
    return <p className="text-muted text-center py-8">Cargando fecha...</p>;
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">No se encontró la fecha.</p>
      </div>
    );
  }

  // Match/tournament derived values
  const winnerTeam = event.type === 'match' && event.match.winning_team_id
    ? event.teams.find((t) => t.id === event.match.winning_team_id)
    : null;
  const tournamentWinnerTeam = event.type === 'tournament' && event.tournament.winning_team_id
    ? event.teams.find((t) => t.id === event.tournament.winning_team_id)
    : null;

  // Build the "gold icon per player" map from the voting results. Only
  // categories with a confirmed winner (either from votes or a resolution)
  // contribute — tied / pending / no_votes leave the player card clean.
  const playerAwards = new Map<number, AwardType[]>();
  for (const result of awards.results) {
    if (result.state === 'winner' && result.winner_id != null) {
      const existing = playerAwards.get(result.winner_id) ?? [];
      existing.push(result.award_type);
      playerAwards.set(result.winner_id, existing);
    }
  }

  const TypeIcon = event.type === 'match' ? SoccerBallIcon
    : event.type === 'tournament' ? TrophyIcon
    : event.type === 'external_match' ? ShieldIcon
    : BarbellIcon;
  const typeLabel = event.type === 'match' ? 'Partido'
    : event.type === 'tournament' ? 'Torneo'
    : event.type === 'external_match' ? 'Partido externo'
    : 'Entrenamiento';

  return (
    <div>
      {glowingWinner && <ConfettiBurst />}
      <h2 className="text-xl font-bold">
        Fecha #{eventNumber}{event.name ? ` · ${event.name}` : ''}
      </h2>
      <p className="flex items-center gap-1.5 text-sm text-muted mt-1">
        <TypeIcon className="w-4 h-4" />
        {typeLabel} — {formatDate(event.played_at)}
      </p>

      {/* Event details box (display or edit mode) */}
      {editingDetails ? (
        <div
          className={`border border-border rounded-lg p-4 mt-3 space-y-3 ${closingDetails ? 'animate-slide-up-out' : 'animate-slide-down-in'}`}
          onAnimationEnd={handleEditorAnimationEnd}
        >
          <div>
            <label className="block text-sm font-medium mb-1">Nombre (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Copa de Verano"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Horario</label>
            <TimeInput value={editTime} onChange={setEditTime} disabled={saving} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cancha (opcional)</label>
            <LocationPicker
              value={editLocationSelection}
              onChange={setEditLocationSelection}
              locations={allLocations}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Costo</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 15000"
              value={editCost}
              onChange={(e) => setEditCost(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Alias/CBU de quien pagó</label>
            <input
              type="text"
              placeholder="Alias o CBU"
              value={editPayee}
              onChange={(e) => setEditPayee(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeDetailsEditor}
              className="flex-1 py-2 rounded-lg font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveDetails}
              disabled={saving || !editTime || !isValidTime(editTime) || !isNewLocationComplete(editLocationSelection)}
              className="flex-1 py-2 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors text-sm"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (() => {
        const hasCost = isAdmin && showCosts && event.cost != null;
        const canShare = event.payee_alias_cbu != null;
        return (
          <div className="border border-border rounded-lg px-4 py-3 mt-3 text-sm text-muted space-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p>
                  {event.location ? (
                    <>
                      <a
                        href={event.location.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-hover underline underline-offset-2"
                      >
                        {event.location.name}
                      </a>
                      {' · '}
                    </>
                  ) : null}
                  {formatTime(event.played_at_time)}
                </p>
                {hasCost && (
                  <p className="flex flex-wrap gap-x-4">
                    <span>Total: {formatPesos(event.cost!)}</span>
                    <span>Inflado: {formatPesos(event.cost! * COST_MARKUP_MULTIPLIER)}</span>
                    {participants.length > 0 && (
                      <span>Por jugador: {formatPesos(perPlayerCost(event.cost!, participants.length))}</span>
                    )}
                    {event.payee_alias_cbu && <span>Pagó: {event.payee_alias_cbu}</span>}
                  </p>
                )}
              </div>
              {isModOrAdmin && (
                <div className="flex items-center gap-1 shrink-0 self-start">
                  {isAdmin && (
                    <Tooltip label="Editar detalles">
                      <button
                        type="button"
                        onClick={openDetailsEditor}
                        className="p-1 rounded text-muted hover:text-on-surface transition-colors"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip label={canShare ? 'Compartir por WhatsApp' : 'Completá alias/CBU para compartir'}>
                    <button
                      type="button"
                      onClick={() => openWhatsAppShare(buildEventShareMessage(event, eventNumber))}
                      disabled={!canShare}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
                    >
                      Compartir
                      <WhatsAppIcon className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Match: Teams */}
      {event.type === 'match' && (
        <>
          <AwardsSection
            eventType={event.type}
            participants={participants}
            voteWindow={awards.voteWindow}
            results={awards.results}
            myVotes={awards.myVotes}
            loading={awards.loading}
            onCastVote={awards.castVote}
            onClearVote={awards.clearVote}
            onResolveTie={awards.resolveTie}
            feedbackBody={feedback.myBody}
            feedbackLoading={feedback.loading}
            onSubmitFeedback={feedback.submit}
            onClearFeedback={feedback.clear}
          />

          {isAdmin && (
            <EventFeedbackAdminSection bodies={feedback.adminBodies} loading={feedback.loading} />
          )}

          <EventMediaStrip eventId={event.id} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {event.teams.map((team) => {
              const matchEvent = event as MatchWithDetails;
              return (
                <BuiltTeamDisplay
                  key={team.id}
                  team={team}
                  isWinner={team.id === matchEvent.match.winning_team_id}
                  playerAwards={playerAwards}
                  canEdit={isModOrAdmin}
                  saving={saving}
                  availablePlayers={availablePlayers}
                  canEditTeam={isAdmin}
                  onSaveTeam={(name, shirtColor) => mutate(() =>
                    supabase.from('match_teams').update({ name, ...(shirtColor ? { shirt_color: shirtColor } : {}) }).eq('id', team.id),
                  )}
                  onAddPlayer={(playerId) => mutate(() =>
                    supabase.from('match_team_players').insert({ match_team_id: team.id, player_id: playerId }),
                  )}
                  onRemovePlayer={(playerId) => mutate(() =>
                    supabase.from('match_team_players').delete().eq('match_team_id', team.id).eq('player_id', playerId),
                  )}
                  moveDestinationsFor={(player): MoveDestination[] => [
                    ...matchEvent.teams.filter((t) => t.id !== team.id).map((otherTeam) => ({
                      label: `Mover a ${otherTeam.name}`,
                      onSelect: () => mutateMove(
                        () => supabase.from('match_team_players').insert({ match_team_id: otherTeam.id, player_id: player.id }),
                        () => supabase.from('match_team_players').delete().eq('match_team_id', team.id).eq('player_id', player.id),
                      ),
                    })),
                    {
                      label: 'Mover a suplentes',
                      onSelect: () => mutateMove(
                        () => supabase.from('match_reserves').insert({ match_id: matchEvent.match.id, player_id: player.id }),
                        () => supabase.from('match_team_players').delete().eq('match_team_id', team.id).eq('player_id', player.id),
                      ),
                    },
                  ]}
                />
              );
            })}
          </div>

          <ReservesList
            reserves={event.reserves}
            canEdit={isModOrAdmin}
            saving={saving}
            availablePlayers={availablePlayers}
            onAddPlayer={(playerId) => mutate(() =>
              supabase.from('match_reserves').insert({ match_id: event.match.id, player_id: playerId }),
            )}
            onRemovePlayer={(playerId) => mutate(() =>
              supabase.from('match_reserves').delete().eq('match_id', event.match.id).eq('player_id', playerId),
            )}
            moveDestinationsFor={(player): MoveDestination[] => (event as MatchWithDetails).teams.map((team) => ({
              label: `Mover a ${team.name}`,
              onSelect: () => mutateMove(
                () => supabase.from('match_team_players').insert({ match_team_id: team.id, player_id: player.id }),
                () => supabase.from('match_reserves').delete().eq('match_id', (event as MatchWithDetails).match.id).eq('player_id', player.id),
              ),
            }))}
          />

          <ResultsSection
            winningTeamId={event.match.winning_team_id}
            teams={event.teams}
            winnerTeamName={winnerTeam?.name ?? null}
            canEdit={isModOrAdmin}
            saving={saving}
            glowingWinner={glowingWinner}
            onWinnerChange={handleWinnerChange}
          />
        </>
      )}

      {/* Tournament */}
      {event.type === 'tournament' && (
        <>
          <AwardsSection
            eventType={event.type}
            participants={participants}
            voteWindow={awards.voteWindow}
            results={awards.results}
            myVotes={awards.myVotes}
            loading={awards.loading}
            onCastVote={awards.castVote}
            onClearVote={awards.clearVote}
            onResolveTie={awards.resolveTie}
            feedbackBody={feedback.myBody}
            feedbackLoading={feedback.loading}
            onSubmitFeedback={feedback.submit}
            onClearFeedback={feedback.clear}
          />

          {isAdmin && (
            <EventFeedbackAdminSection bodies={feedback.adminBodies} loading={feedback.loading} />
          )}

          <EventMediaStrip eventId={event.id} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {event.teams.map((team) => {
              const tournamentEvent = event as TournamentWithDetails;
              return (
                <TournamentTeamCard
                  key={team.id}
                  team={team}
                  isWinner={team.id === tournamentEvent.tournament.winning_team_id}
                  playerAwards={playerAwards}
                  canEdit={isModOrAdmin}
                  saving={saving}
                  availablePlayers={availablePlayers}
                  canEditTeam={isAdmin}
                  onSaveTeam={(name) => mutate(() =>
                    supabase.from('tournament_teams').update({ name }).eq('id', team.id),
                  )}
                  onAddPlayer={(playerId) => mutate(() =>
                    supabase.from('tournament_team_players').insert({ tournament_team_id: team.id, player_id: playerId }),
                  )}
                  onRemovePlayer={(playerId) => mutate(() =>
                    supabase.from('tournament_team_players').delete().eq('tournament_team_id', team.id).eq('player_id', playerId),
                  )}
                  moveDestinationsFor={(player): MoveDestination[] => [
                    ...tournamentEvent.teams.filter((t) => t.id !== team.id).map((otherTeam) => ({
                      label: `Mover a ${otherTeam.name}`,
                      onSelect: () => mutateMove(
                        () => supabase.from('tournament_team_players').insert({ tournament_team_id: otherTeam.id, player_id: player.id }),
                        () => supabase.from('tournament_team_players').delete().eq('tournament_team_id', team.id).eq('player_id', player.id),
                      ),
                    })),
                    {
                      label: 'Mover a suplentes',
                      onSelect: () => mutateMove(
                        () => supabase.from('tournament_reserves').insert({ tournament_id: tournamentEvent.tournament.id, player_id: player.id }),
                        () => supabase.from('tournament_team_players').delete().eq('tournament_team_id', team.id).eq('player_id', player.id),
                      ),
                    },
                  ]}
                />
              );
            })}
          </div>

          <ReservesList
            reserves={event.reserves}
            canEdit={isModOrAdmin}
            saving={saving}
            availablePlayers={availablePlayers}
            onAddPlayer={(playerId) => mutate(() =>
              supabase.from('tournament_reserves').insert({ tournament_id: event.tournament.id, player_id: playerId }),
            )}
            onRemovePlayer={(playerId) => mutate(() =>
              supabase.from('tournament_reserves').delete().eq('tournament_id', event.tournament.id).eq('player_id', playerId),
            )}
            moveDestinationsFor={(player): MoveDestination[] => (event as TournamentWithDetails).teams.map((team) => ({
              label: `Mover a ${team.name}`,
              onSelect: () => mutateMove(
                () => supabase.from('tournament_team_players').insert({ tournament_team_id: team.id, player_id: player.id }),
                () => supabase.from('tournament_reserves').delete().eq('tournament_id', (event as TournamentWithDetails).tournament.id).eq('player_id', player.id),
              ),
            }))}
          />

          <TournamentMatchList
            teams={event.teams}
            matches={event.tournamentMatches}
            canEdit={isModOrAdmin}
            saving={saving}
            onAddMatch={handleAddTournamentMatch}
            onUpdateScore={handleUpdateTournamentMatchScore}
            onDeleteMatch={handleDeleteTournamentMatch}
          />

          <StandingsTable teams={event.teams} matches={event.tournamentMatches} />

          <ResultsSection
            winningTeamId={event.tournament.winning_team_id}
            teams={event.teams}
            winnerTeamName={tournamentWinnerTeam?.name ?? null}
            canEdit={isModOrAdmin}
            saving={saving}
            glowingWinner={glowingWinner}
            onWinnerChange={handleTournamentWinnerChange}
          />
        </>
      )}

      {/* External match: our roster vs an external opponent. No awards/feedback. */}
      {event.type === 'external_match' && (
        <>
          <EventMediaStrip eventId={event.id} />

          <ExternalMatchRoster
            roster={event.roster}
            canEditParticipants={isModOrAdmin}
            canEditGoals={isAdmin}
            saving={saving}
            availablePlayers={availablePlayers}
            onAddPlayer={(playerId) => mutate(() =>
              supabase.from('external_match_players').insert({ external_match_id: (event as ExternalMatchWithDetails).externalMatch.id, player_id: playerId }),
            )}
            onRemovePlayer={(playerId) => mutate(() =>
              supabase.from('external_match_players').delete().eq('external_match_id', (event as ExternalMatchWithDetails).externalMatch.id).eq('player_id', playerId),
            )}
            onSetGoals={handleSetGoals}
            moveDestinationsFor={(player): MoveDestination[] => [
              {
                label: 'Mover a suplentes',
                onSelect: () => mutateMove(
                  () => supabase.from('external_match_reserves').insert({ external_match_id: (event as ExternalMatchWithDetails).externalMatch.id, player_id: player.id }),
                  () => supabase.from('external_match_players').delete().eq('external_match_id', (event as ExternalMatchWithDetails).externalMatch.id).eq('player_id', player.id),
                ),
              },
            ]}
          />

          <ReservesList
            reserves={event.reserves}
            canEdit={isModOrAdmin}
            saving={saving}
            availablePlayers={availablePlayers}
            onAddPlayer={(playerId) => mutate(() =>
              supabase.from('external_match_reserves').insert({ external_match_id: event.externalMatch.id, player_id: playerId }),
            )}
            onRemovePlayer={(playerId) => mutate(() =>
              supabase.from('external_match_reserves').delete().eq('external_match_id', event.externalMatch.id).eq('player_id', playerId),
            )}
            moveDestinationsFor={(player): MoveDestination[] => [
              {
                label: 'Mover a titulares',
                onSelect: () => mutateMove(
                  () => supabase.from('external_match_players').insert({ external_match_id: (event as ExternalMatchWithDetails).externalMatch.id, player_id: player.id }),
                  () => supabase.from('external_match_reserves').delete().eq('external_match_id', (event as ExternalMatchWithDetails).externalMatch.id).eq('player_id', player.id),
                ),
              },
            ]}
          />

          <ExternalMatchScoreCard
            match={event.externalMatch}
            opponentName={event.opponent.name}
            canEdit={isAdmin}
            saving={saving}
            glowing={glowingWinner}
            onSave={handleExternalScoreChange}
          />

          <ExternalMatchHeadToHead
            externalTeamId={event.opponent.id}
            opponentName={event.opponent.name}
            refreshToken={`${event.externalMatch.our_score}-${event.externalMatch.their_score}`}
          />
        </>
      )}

      {/* Training: Attendees and Coaches */}
      {event.type === 'training' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <TrainingParticipantsList
            title="Jugadores"
            participants={event.attendees}
            canEdit={isModOrAdmin}
            saving={saving}
            availablePlayers={availablePlayers}
            onAddPlayer={(playerId) => mutate(() =>
              supabase.from('training_attendees').insert({ training_id: event.training.id, player_id: playerId }),
            )}
            onRemovePlayer={(playerId) => mutate(() =>
              supabase.from('training_attendees').delete().eq('training_id', event.training.id).eq('player_id', playerId),
            )}
            moveDestinationsFor={(player): MoveDestination[] => [
              {
                label: 'Pasar a entrenadores',
                onSelect: () => mutateMove(
                  () => supabase.from('training_coaches').insert({ training_id: event.training.id, player_id: player.id }),
                  () => supabase.from('training_attendees').delete().eq('training_id', event.training.id).eq('player_id', player.id),
                ),
              },
            ]}
          />

          <TrainingParticipantsList
            title="Entrenadores"
            participants={event.coaches}
            canEdit={isModOrAdmin}
            saving={saving}
            availablePlayers={availablePlayers}
            onAddPlayer={(playerId) => mutate(() =>
              supabase.from('training_coaches').insert({ training_id: event.training.id, player_id: playerId }),
            )}
            onRemovePlayer={(playerId) => mutate(() =>
              supabase.from('training_coaches').delete().eq('training_id', event.training.id).eq('player_id', playerId),
            )}
            moveDestinationsFor={(player): MoveDestination[] => [
              {
                label: 'Pasar a jugadores',
                onSelect: () => mutateMove(
                  () => supabase.from('training_attendees').insert({ training_id: event.training.id, player_id: player.id }),
                  () => supabase.from('training_coaches').delete().eq('training_id', event.training.id).eq('player_id', player.id),
                ),
              },
            ]}
          />
        </div>
      )}

      {event.type === 'training' && <EventMediaStrip eventId={event.id} />}

      {isAdmin && (
        <ConfirmAction
          label="Eliminar fecha"
          message="¿Eliminar esta fecha? Esta acción no se puede deshacer."
          onConfirm={handleDelete}
          className="mt-6"
        />
      )}
    </div>
  );
}
