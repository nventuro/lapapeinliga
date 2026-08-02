import type { ReactNode } from 'react';
import type { AwardType, EventTeam, Player } from '../types';
import { supabase } from '../lib/supabase';
import TeamCard from './TeamCard';
import ParticipantListCard from './ParticipantListCard';
import ResultsSection from './ResultsSection';
import type { MoveDestination } from './ParticipantRow';

type MutationOp = () => PromiseLike<{ error: { message: string } | null }>;

interface TeamEventSectionProps {
  eventId: number;
  teams: EventTeam[];
  reserves: Player[];
  winningTeamId: number | null;
  playerAwards: Map<number, AwardType[]>;
  availablePlayers: Player[];
  saving: boolean;
  glowingWinner: boolean;
  canEditRoster: boolean;
  canEditTeam: boolean;
  showAverageRating?: boolean;
  gridClassName: string;
  mutate: (op: MutationOp) => Promise<void>;
  onWinnerChange: (teamId: number | null) => void;
  /** Rendered between the reserves and the results (fixtures, standings). */
  children?: ReactNode;
}

/**
 * Teams grid + reserves + winner picker for a team-structured event. Matches
 * and tournaments share the unified event_teams / event_participants tables,
 * so all the add/remove/move plumbing is identical for both. A move is a
 * single UPDATE of the participant's kind/team, which keeps the player a
 * participant throughout — the award-integrity trigger only guards removals.
 */
export default function TeamEventSection({
  eventId,
  teams,
  reserves,
  winningTeamId,
  playerAwards,
  availablePlayers,
  saving,
  glowingWinner,
  canEditRoster,
  canEditTeam,
  showAverageRating = false,
  gridClassName,
  mutate,
  onWinnerChange,
  children,
}: TeamEventSectionProps) {
  const addToTeam = (teamId: number, playerId: number): MutationOp =>
    () => supabase.from('event_participants')
      .insert({ event_id: eventId, player_id: playerId, kind: 'team_member', team_id: teamId });
  const addReserve = (playerId: number): MutationOp =>
    () => supabase.from('event_participants')
      .insert({ event_id: eventId, player_id: playerId, kind: 'reserve' });
  const remove = (playerId: number): MutationOp =>
    () => supabase.from('event_participants')
      .delete().eq('event_id', eventId).eq('player_id', playerId);
  const moveToTeam = (teamId: number, playerId: number): MutationOp =>
    () => supabase.from('event_participants')
      .update({ kind: 'team_member', team_id: teamId }).eq('event_id', eventId).eq('player_id', playerId);
  const moveToReserves = (playerId: number): MutationOp =>
    () => supabase.from('event_participants')
      .update({ kind: 'reserve', team_id: null }).eq('event_id', eventId).eq('player_id', playerId);

  const winnerTeam = winningTeamId != null ? teams.find((t) => t.id === winningTeamId) : null;

  return (
    <>
      <div className={gridClassName}>
        {teams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            isWinner={team.id === winningTeamId}
            playerAwards={playerAwards}
            canEdit={canEditRoster}
            saving={saving}
            availablePlayers={availablePlayers}
            canEditTeam={canEditTeam}
            showAverageRating={showAverageRating}
            onSaveTeam={(name, shirtColor) => mutate(() =>
              supabase.from('event_teams').update({ name, ...(shirtColor ? { shirt_color: shirtColor } : {}) }).eq('id', team.id),
            )}
            onAddPlayer={(playerId) => mutate(addToTeam(team.id, playerId))}
            onRemovePlayer={(playerId) => mutate(remove(playerId))}
            moveDestinationsFor={(player): MoveDestination[] => [
              ...teams.filter((t) => t.id !== team.id).map((otherTeam) => ({
                label: `Mover a ${otherTeam.name}`,
                onSelect: () => mutate(moveToTeam(otherTeam.id, player.id)),
              })),
              {
                label: 'Mover a suplentes',
                onSelect: () => mutate(moveToReserves(player.id)),
              },
            ]}
          />
        ))}
      </div>

      <ParticipantListCard
        title="Suplentes"
        players={reserves}
        canEdit={canEditRoster}
        saving={saving}
        availablePlayers={availablePlayers}
        hideWhenEmpty
        className="mt-4"
        onAddPlayer={(playerId) => mutate(addReserve(playerId))}
        onRemovePlayer={(playerId) => mutate(remove(playerId))}
        moveDestinationsFor={(player): MoveDestination[] => teams.map((team) => ({
          label: `Mover a ${team.name}`,
          onSelect: () => mutate(moveToTeam(team.id, player.id)),
        }))}
      />

      {children}

      <ResultsSection
        winningTeamId={winningTeamId}
        teams={teams}
        winnerTeamName={winnerTeam?.name ?? null}
        canEdit={canEditRoster}
        saving={saving}
        glowingWinner={glowingWinner}
        onWinnerChange={onWinnerChange}
      />
    </>
  );
}
