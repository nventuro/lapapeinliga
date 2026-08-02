import type { Player, AwardType, ShirtColor } from '../types';
import { comparePlayersByGenderThenName } from '../types';
import { teamAverageRating } from '../utils/scoring';
import { useAppContext } from '../context/appContext';
import Confetti from './Confetti';
import EditableTeamName from './EditableTeamName';
import GenderCountFooter from './GenderCountFooter';
import ParticipantRow, { type MoveDestination } from './ParticipantRow';
import AddParticipantControl from './AddParticipantControl';

interface TeamCardProps {
  team: { id: number; name: string; shirt_color?: ShirtColor | null; players: Player[] };
  isWinner: boolean;
  playerAwards: Map<number, AwardType[]>;
  canEdit?: boolean;
  saving?: boolean;
  availablePlayers?: Player[];
  moveDestinationsFor?: (player: Player) => MoveDestination[];
  onAddPlayer?: (playerId: number) => void;
  onRemovePlayer?: (playerId: number) => void;
  canEditTeam?: boolean;
  onSaveTeam?: (name: string, shirtColor?: ShirtColor) => void;
  /** Show the admin-only team rating average in the header (regular matches). */
  showAverageRating?: boolean;
}

/**
 * A team's roster card on the event detail page. Shared between regular
 * matches (shirt color + rating average) and tournaments — they render the
 * same card, so a change here fixes both.
 */
export default function TeamCard({
  team,
  isWinner,
  playerAwards,
  canEdit = false,
  saving = false,
  availablePlayers = [],
  moveDestinationsFor,
  onAddPlayer,
  onRemovePlayer,
  canEditTeam = false,
  onSaveTeam,
  showAverageRating = false,
}: TeamCardProps) {
  const { isAdmin, showRatings } = useAppContext();

  return (
    <div
      className={`relative rounded-lg p-4 ${
        isWinner ? 'border-2 border-lime bg-lime-subtle' : 'bg-surface border border-border'
      }`}
    >
      {isWinner && <Confetti />}
      <EditableTeamName
        name={team.name}
        shirtColor={team.shirt_color ?? undefined}
        isWinner={isWinner}
        trailing={showAverageRating && isAdmin && showRatings ? (
          <span className="text-sm text-muted shrink-0">
            Promedio: {teamAverageRating(team).toFixed(1)}
          </span>
        ) : undefined}
        canEdit={canEditTeam}
        saving={saving}
        onSave={onSaveTeam}
      />
      <ul className="space-y-1">
        {[...team.players].sort(comparePlayersByGenderThenName).map((player) => (
          <ParticipantRow
            key={player.id}
            player={player}
            awards={playerAwards.get(player.id)}
            canEdit={canEdit}
            disabled={saving}
            moveDestinations={moveDestinationsFor?.(player) ?? []}
            onRemove={onRemovePlayer ? () => onRemovePlayer(player.id) : undefined}
          />
        ))}
      </ul>
      {canEdit && onAddPlayer && (
        <AddParticipantControl
          availablePlayers={availablePlayers}
          onAdd={onAddPlayer}
          disabled={saving}
        />
      )}
      <GenderCountFooter players={team.players} />
    </div>
  );
}
