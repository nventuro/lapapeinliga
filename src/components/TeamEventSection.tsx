import type { ReactNode } from 'react';
import type { AwardType, Player, ShirtColor } from '../types';
import { supabase } from '../lib/supabase';
import TeamCard from './TeamCard';
import ParticipantListCard from './ParticipantListCard';
import ResultsSection from './ResultsSection';
import type { MoveDestination } from './ParticipantRow';
import type { TeamRosterConfig } from './teamRosterConfig';

type MutationOp = () => PromiseLike<{ error: { message: string } | null }>;

interface TeamEventSectionProps {
  config: TeamRosterConfig;
  /** The child row id (matches.id / tournaments.id) reserves hang off. */
  parentId: number;
  teams: { id: number; name: string; shirt_color?: ShirtColor; players: Player[] }[];
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
  mutateMove: (insertOp: MutationOp, deleteOp: MutationOp) => Promise<void>;
  onWinnerChange: (teamId: number | null) => void;
  /** Rendered between the reserves and the results (fixtures, standings). */
  children?: ReactNode;
}

/**
 * Teams grid + reserves + winner picker for a team-structured event. All the
 * add/remove/move plumbing derives from the TeamRosterConfig, so match and
 * tournament pages can never drift apart again.
 */
export default function TeamEventSection({
  config,
  parentId,
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
  mutateMove,
  onWinnerChange,
  children,
}: TeamEventSectionProps) {
  const addToTeam = (teamId: number, playerId: number): MutationOp =>
    () => supabase.from(config.teamPlayersTable).insert({ [config.teamFkColumn]: teamId, player_id: playerId });
  const removeFromTeam = (teamId: number, playerId: number): MutationOp =>
    () => supabase.from(config.teamPlayersTable).delete().eq(config.teamFkColumn, teamId).eq('player_id', playerId);
  const addReserve = (playerId: number): MutationOp =>
    () => supabase.from(config.reservesTable).insert({ [config.parentFkColumn]: parentId, player_id: playerId });
  const removeReserve = (playerId: number): MutationOp =>
    () => supabase.from(config.reservesTable).delete().eq(config.parentFkColumn, parentId).eq('player_id', playerId);

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
              supabase.from(config.teamsTable).update({ name, ...(shirtColor ? { shirt_color: shirtColor } : {}) }).eq('id', team.id),
            )}
            onAddPlayer={(playerId) => mutate(addToTeam(team.id, playerId))}
            onRemovePlayer={(playerId) => mutate(removeFromTeam(team.id, playerId))}
            moveDestinationsFor={(player): MoveDestination[] => [
              ...teams.filter((t) => t.id !== team.id).map((otherTeam) => ({
                label: `Mover a ${otherTeam.name}`,
                onSelect: () => mutateMove(addToTeam(otherTeam.id, player.id), removeFromTeam(team.id, player.id)),
              })),
              {
                label: 'Mover a suplentes',
                onSelect: () => mutateMove(addReserve(player.id), removeFromTeam(team.id, player.id)),
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
        onRemovePlayer={(playerId) => mutate(removeReserve(playerId))}
        moveDestinationsFor={(player): MoveDestination[] => teams.map((team) => ({
          label: `Mover a ${team.name}`,
          onSelect: () => mutateMove(addToTeam(team.id, player.id), removeReserve(player.id)),
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
