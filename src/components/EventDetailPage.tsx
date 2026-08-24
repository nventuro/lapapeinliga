import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConfirmAction from './ConfirmAction';
import type { AwardType, Location, ParticipantKind } from '../types';
import { allParticipants, externalMatchResult, hasFinances, isExternalWin, isNewLocationComplete, OUR_TEAM_NAME, WINNER_GLOW_MS } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { isValidTime } from '../utils/dateUtils';
import { parseCostInput } from '../utils/costUtils';
import ConfettiBurst from './ConfettiBurst';
import CostSummary from './CostSummary';
import EventFieldsForm from './EventFieldsForm';
import EventHero from './EventHero';
import EventMediaStrip from './EventMediaStrip';
import EventSharePoster from './EventSharePoster';
import ShareCopiedDialog from './ShareCopiedDialog';
import TeamEventSection from './TeamEventSection';
import { resolveLocationSelection, useEventFieldsState } from '../hooks/useEventFields';
import TournamentMatchList from './TournamentMatchList';
import StandingsTable from './StandingsTable';
import ExternalMatchPlayerList from './ExternalMatchPlayerList';
import ExternalMatchScoreCard from './ExternalMatchScoreCard';
import ExternalMatchHeadToHead from './ExternalMatchHeadToHead';
import AwardsSection from './AwardsSection';
import EventFeedbackAdminSection from './EventFeedbackAdminSection';
import ParticipantListCard from './ParticipantListCard';
import SectionLabel from './SectionLabel';
import type { MoveDestination } from './ParticipantRow';
import { useEventAwards } from '../hooks/useEventAwards';
import { useEventDetail } from '../hooks/useEventDetail';
import { useEventFeedback } from '../hooks/useEventFeedback';
import { useEventImageShare } from '../hooks/useEventImageShare';
import { useEventsIndex } from '../hooks/useEventsIndex';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';

type MutationOp = () => PromiseLike<{ error: { message: string } | null }>;

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { players, isAdmin, isModOrAdmin, showCosts } = useAppContext();

  const { event, loading, error, refetch } = useEventDetail(id);
  const { labels, loading: labelsLoading } = useEventsIndex();
  // Empty while the index loads, so the header/share can't emit "Fecha #?".
  const eventNumber = event && !labelsLoading ? (labels.get(event.id) ?? '?') : '';

  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Winner glow: single timer, cleared on re-trigger and unmount.
  const [glowingWinner, setGlowingWinner] = useState(false);
  const glowTimerRef = useRef<number | null>(null);
  const triggerGlow = useCallback(() => {
    setGlowingWinner(true);
    if (glowTimerRef.current != null) clearTimeout(glowTimerRef.current);
    glowTimerRef.current = window.setTimeout(() => setGlowingWinner(false), WINNER_GLOW_MS);
  }, []);
  useEffect(() => () => {
    if (glowTimerRef.current != null) clearTimeout(glowTimerRef.current);
  }, []);

  const {
    phase: sharePhase,
    posterMountRef,
    start: startImageShare,
    closeDialog: closeShareDialog,
  } = useEventImageShare(event, eventNumber);
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
  const [editError, setEditError] = useState<string | null>(null);
  const editFields = useEventFieldsState();
  const { data: allLocations, refetch: refetchLocations } = useSupabaseQuery(async () => {
    const { data, error } = await supabase.from('locations').select('*').order('name');
    if (error) throw new Error(error.message);
    return data as Location[];
  }, [], { enabled: isAdmin });

  const participants = event ? allParticipants(event) : [];
  const participantIds = new Set(participants.map((p) => p.id));
  const availablePlayers = event ? players.filter((p) => !participantIds.has(p.id)) : [];

  // Wraps a single supabase mutation with saving state + error surfacing +
  // reload. The trigger that protects award integrity raises a plain
  // Postgres error; its message comes through as `error.message` here.
  async function mutate(op: MutationOp, options: { glow?: boolean } = {}) {
    setSaving(true);
    setMutationError(null);
    const { error } = await op();
    if (error) {
      setMutationError(error.message);
    } else {
      refetch();
      if (options.glow) triggerGlow();
    }
    setSaving(false);
  }

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
    editFields.setName(event.name ?? '');
    editFields.setTime(event.played_at_time.slice(0, 5));
    editFields.setCost(event.finances?.cost != null ? String(event.finances.cost) : '');
    editFields.setPayee(event.finances?.payee_alias_cbu ?? '');
    editFields.setLocationSelection(
      event.location_id != null ? { type: 'existing', locationId: event.location_id } : { type: 'none' },
    );
    setEditError(null);
    setEditingDetails(true);
  }

  async function handleSaveDetails() {
    if (!event) return;
    if (!editFields.time || !isValidTime(editFields.time)) return;
    setEditError(null);

    // Social events never carry a cost: the editor hides both fields.
    const editsFinances = hasFinances(event.type);
    const costParsed = editsFinances ? parseCostInput(editFields.cost) : { value: null, error: null };
    if (costParsed.error) {
      setEditError(costParsed.error);
      return;
    }

    setSaving(true);

    const resolved = await resolveLocationSelection(editFields.locationSelection);
    if ('error' in resolved) {
      setEditError(resolved.error);
      setSaving(false);
      return;
    }
    if (resolved.created) refetchLocations();

    const { error: eventError } = await supabase
      .from('events')
      .update({
        name: editFields.name.trim() || null,
        played_at_time: editFields.time,
        location_id: resolved.locationId,
      })
      .eq('id', event.id);
    if (eventError) {
      setEditError(eventError.message);
      setSaving(false);
      return;
    }

    // Financial fields live in the mod/admin-only event_finances table.
    if (editsFinances) {
      const { error: financesError } = await supabase
        .from('event_finances')
        .upsert(
          { event_id: event.id, cost: costParsed.value, payee_alias_cbu: editFields.payee.trim() || null },
          { onConflict: 'event_id' },
        );
      if (financesError) {
        // The event row was already updated; surface the partial failure
        // instead of silently keeping the editor open with no explanation.
        setEditError(`Se guardaron los detalles pero no el costo: ${financesError.message}`);
        setSaving(false);
        return;
      }
    }

    refetch();
    closeDetailsEditor();
    setSaving(false);
  }

  // Mods can set the winner but hold no direct UPDATE on events, so this goes
  // through the RPC that owns that one column.
  function handleSetWinner(eventId: number, teamId: number | null) {
    return mutate(
      () => supabase.rpc('set_event_winner', { p_event_id: eventId, p_team_id: teamId }),
      { glow: teamId !== null },
    );
  }

  function handleSetGoals(eventId: number, playerId: number, goals: number) {
    return mutate(() =>
      supabase.from('event_participants').update({ goals }).eq('event_id', eventId).eq('player_id', playerId),
    );
  }

  // Moving is one UPDATE of the same row, so goals and any other per-player
  // data ride along instead of having to be copied to a new row.
  function moveParticipant(eventId: number, playerId: number, kind: ParticipantKind) {
    return mutate(() =>
      supabase.from('event_participants').update({ kind }).eq('event_id', eventId).eq('player_id', playerId),
    );
  }

  async function handleDelete() {
    if (!event) return;
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      setMutationError(`Error al eliminar: ${error.message}`);
      return;
    }
    navigate('/fechas');
  }

  if (loading && !event) {
    return <p className="text-muted text-center py-8">Cargando fecha...</p>;
  }

  // A full-screen error only when there is nothing to show: a failed REFETCH
  // (e.g. flaky connection after a mutation) keeps the loaded event on screen
  // and surfaces the error in the banner below instead.
  if (error && !event) {
    return (
      <div className="text-center py-12">
        <p className="text-error">Error al cargar la fecha: {error}</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">No se encontró la fecha.</p>
      </div>
    );
  }

  // Keep mutation controls disabled until the post-mutation refetch lands:
  // otherwise there's a window where stale rosters render with re-enabled
  // buttons and a double-tap inserts twice.
  const busy = saving || loading;
  const bannerError = mutationError ?? error;

  // Build the "award icon per player" map from the voting results. Only
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

  // Social events have no cost split, so their editor and share drop the
  // financial fields entirely.
  const showFinances = hasFinances(event.type);
  // The share embeds who to pay, so it needs an alias/CBU — except for
  // social events, whose share is just the date, time and place.
  const canShare = (event.finances?.payee_alias_cbu != null || !showFinances) && eventNumber !== '';

  const awardsAndMedia = (
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
    </>
  );

  return (
    <div>
      {glowingWinner && <ConfettiBurst />}
      <EventHero
        event={event}
        eventNumber={eventNumber}
        canShare={canShare}
        onShare={startImageShare}
        onEdit={openDetailsEditor}
      />

      {/* Mounted only for the capture, off-screen but laid out (display:none
          would give the rasterizer nothing to measure). */}
      {sharePhase === 'capturing' && (
        <div ref={posterMountRef} aria-hidden className="fixed top-0 -left-[9999px]">
          <EventSharePoster event={event} eventNumber={eventNumber} />
        </div>
      )}
      {sharePhase === 'copied' && <ShareCopiedDialog onClose={closeShareDialog} />}

      {bannerError && (
        <p className="text-sm text-error mt-2">{bannerError}</p>
      )}

      {editingDetails && (
        <div
          className={`bg-surface border border-border rounded-lg p-4 mt-3 space-y-3 ${closingDetails ? 'animate-slide-up-out' : 'animate-slide-down-in'}`}
          onAnimationEnd={handleEditorAnimationEnd}
        >
          <EventFieldsForm
            fields={editFields}
            locations={allLocations ?? []}
            showFinances={showFinances}
            disabled={busy}
          />
          {editError && <p className="text-sm text-error">{editError}</p>}
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
              disabled={busy || !editFields.time || !isValidTime(editFields.time) || !isNewLocationComplete(editFields.locationSelection)}
              className="flex-1 py-2 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors text-sm"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {isAdmin && showCosts && (
        <div className="bg-surface border border-border rounded-lg px-4 py-3 mt-3">
          <CostSummary finances={event.finances} participantCount={participants.length} className="gap-x-4" />
        </div>
      )}

      {/* Match: Teams */}
      {event.type === 'match' && (
        <>
          {awardsAndMedia}
          <TeamEventSection
            eventId={event.id}
            teams={event.teams}
            reserves={event.reserves}
            winningTeamId={event.winning_team_id}
            playerAwards={playerAwards}
            availablePlayers={availablePlayers}
            saving={busy}
            glowingWinner={glowingWinner}
            canEditRoster={isModOrAdmin}
            canEditTeam={isAdmin}
            showAverageRating
            mutate={mutate}
            onWinnerChange={(teamId) => handleSetWinner(event.id, teamId)}
          />
        </>
      )}

      {/* Tournament */}
      {event.type === 'tournament' && (
        <>
          {awardsAndMedia}
          <TeamEventSection
            eventId={event.id}
            teams={event.teams}
            reserves={event.reserves}
            winningTeamId={event.winning_team_id}
            playerAwards={playerAwards}
            availablePlayers={availablePlayers}
            saving={busy}
            glowingWinner={glowingWinner}
            canEditRoster={isModOrAdmin}
            canEditTeam={isAdmin}
            mutate={mutate}
            onWinnerChange={(teamId) => handleSetWinner(event.id, teamId)}
          >
            <TournamentMatchList
              teams={event.teams}
              matches={event.tournamentMatches}
              canEdit={isModOrAdmin}
              saving={busy}
              onAddMatch={(teamAId, teamBId) => mutate(() =>
                supabase.from('tournament_matches').insert({ event_id: event.id, team_a_id: teamAId, team_b_id: teamBId }),
              )}
              onUpdateScore={(matchId, scoreA, scoreB) => mutate(() =>
                supabase.from('tournament_matches').update({ score_a: scoreA, score_b: scoreB }).eq('id', matchId),
              )}
              onDeleteMatch={(matchId) => mutate(() =>
                supabase.from('tournament_matches').delete().eq('id', matchId),
              )}
            />
            <StandingsTable teams={event.teams} matches={event.tournamentMatches} />
          </TeamEventSection>
        </>
      )}

      {/* External match: our roster vs an external opponent. No awards/feedback. */}
      {event.type === 'external_match' && (
        <>
          <EventMediaStrip eventId={event.id} />

          <SectionLabel dim className="mt-6 mb-2">EQUIPO</SectionLabel>
          <ExternalMatchPlayerList
            className=""
            title={OUR_TEAM_NAME}
            roster={event.roster}
            canEditParticipants={isModOrAdmin}
            canEditGoals={isAdmin}
            saving={busy}
            availablePlayers={availablePlayers}
            onAddPlayer={(playerId) => mutate(() =>
              supabase.from('event_participants').insert({ event_id: event.id, player_id: playerId, kind: 'team_member' }),
            )}
            onRemovePlayer={(playerId) => mutate(() =>
              supabase.from('event_participants').delete().eq('event_id', event.id).eq('player_id', playerId),
            )}
            onSetGoals={(playerId, goals) => handleSetGoals(event.id, playerId, goals)}
            moveDestinationsFor={(player): MoveDestination[] => [
              {
                label: 'Mover a suplentes',
                onSelect: () => moveParticipant(event.id, player.id, 'reserve'),
              },
            ]}
          />

          <ExternalMatchPlayerList
            className="mt-4"
            title="Suplentes"
            roster={event.reserves}
            canEditParticipants={isModOrAdmin}
            canEditGoals={isAdmin}
            saving={busy}
            availablePlayers={availablePlayers}
            hideWhenEmpty
            onAddPlayer={(playerId) => mutate(() =>
              supabase.from('event_participants').insert({ event_id: event.id, player_id: playerId, kind: 'reserve' }),
            )}
            onRemovePlayer={(playerId) => mutate(() =>
              supabase.from('event_participants').delete().eq('event_id', event.id).eq('player_id', playerId),
            )}
            onSetGoals={(playerId, goals) => handleSetGoals(event.id, playerId, goals)}
            moveDestinationsFor={(player): MoveDestination[] => [
              {
                label: 'Mover a titulares',
                onSelect: () => moveParticipant(event.id, player.id, 'team_member'),
              },
            ]}
          />

          {isAdmin && (
            <ExternalMatchScoreCard
              match={event.externalMatch}
              opponentName={event.opponent.name}
              canEdit={isAdmin}
              saving={busy}
              glowing={glowingWinner}
              onSave={(ourScore, theirScore, ourPenalties, theirPenalties) => mutate(
                () => supabase.from('external_matches').update({
                  our_score: ourScore,
                  their_score: theirScore,
                  our_penalties: ourPenalties,
                  their_penalties: theirPenalties,
                }).eq('id', event.externalMatch.id),
                // Celebrate only a win, not a loss or draw.
                { glow: isExternalWin(externalMatchResult(ourScore, theirScore, ourPenalties, theirPenalties)) },
              )}
            />
          )}

          <ExternalMatchHeadToHead
            externalTeamId={event.opponent.id}
            opponentName={event.opponent.name}
            refreshToken={`${event.externalMatch.our_score}-${event.externalMatch.their_score}-${event.externalMatch.our_penalties}-${event.externalMatch.their_penalties}`}
          />
        </>
      )}

      {/* Training: Attendees and Coaches */}
      {event.type === 'training' && (
        <>
          <EventMediaStrip eventId={event.id} />
          <div className="participant-grid mt-6">
            <ParticipantListCard
              title="Jugadores"
              players={event.attendees}
              canEdit={isModOrAdmin}
              saving={busy}
              availablePlayers={availablePlayers}
              onAddPlayer={(playerId) => mutate(() =>
                supabase.from('event_participants').insert({ event_id: event.id, player_id: playerId, kind: 'attendee' }),
              )}
              onRemovePlayer={(playerId) => mutate(() =>
                supabase.from('event_participants').delete().eq('event_id', event.id).eq('player_id', playerId),
              )}
              moveDestinationsFor={(player): MoveDestination[] => [
                {
                  label: 'Pasar a entrenadores',
                  onSelect: () => moveParticipant(event.id, player.id, 'coach'),
                },
              ]}
            />

            <ParticipantListCard
              title="Entrenadores"
              players={event.coaches}
              canEdit={isModOrAdmin}
              saving={busy}
              availablePlayers={availablePlayers}
              onAddPlayer={(playerId) => mutate(() =>
                supabase.from('event_participants').insert({ event_id: event.id, player_id: playerId, kind: 'coach' }),
              )}
              onRemovePlayer={(playerId) => mutate(() =>
                supabase.from('event_participants').delete().eq('event_id', event.id).eq('player_id', playerId),
              )}
              moveDestinationsFor={(player): MoveDestination[] => [
                {
                  label: 'Pasar a jugadores',
                  onSelect: () => moveParticipant(event.id, player.id, 'attendee'),
                },
              ]}
            />
          </div>
        </>
      )}

      {event.type === 'social' && <EventMediaStrip eventId={event.id} />}

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
