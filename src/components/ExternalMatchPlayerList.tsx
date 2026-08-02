import type { ExternalMatchPlayer, Player } from '../types';
import { comparePlayersByGenderThenName } from '../types';
import { GenderMaleIcon, GenderFemaleIcon, SoccerBallIcon, PlusIcon } from './icons';
import ParticipantRow, { type MoveDestination } from './ParticipantRow';
import AddParticipantControl from './AddParticipantControl';
import Tooltip from './Tooltip';

interface ExternalMatchPlayerListProps {
  title: string;
  roster: ExternalMatchPlayer[];
  canEditParticipants: boolean;
  canEditGoals: boolean;
  saving: boolean;
  availablePlayers: Player[];
  moveDestinationsFor: (player: Player) => MoveDestination[];
  onAddPlayer: (playerId: number) => void;
  onRemovePlayer: (playerId: number) => void;
  onSetGoals: (playerId: number, goals: number) => void;
  /** Hide the whole card when empty and not editable (used for reserves). */
  hideWhenEmpty?: boolean;
}

function GoalsControl({
  goals,
  canEdit,
  saving,
  onChange,
}: {
  goals: number;
  canEdit: boolean;
  saving: boolean;
  onChange: (goals: number) => void;
}) {
  if (canEdit) {
    return (
      <div className="flex items-center gap-1">
        <Tooltip label="Quitar gol">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, goals - 1))}
            disabled={saving || goals === 0}
            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-on-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            −
          </button>
        </Tooltip>
        <span className="flex items-center gap-0.5 tabular-nums text-sm min-w-[2.5rem] justify-center">
          <SoccerBallIcon className="w-4 h-4" />
          {goals}
        </span>
        <Tooltip label="Sumar gol">
          <button
            type="button"
            onClick={() => onChange(goals + 1)}
            disabled={saving}
            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-on-surface disabled:cursor-not-allowed transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    );
  }

  if (goals === 0) return null;
  return (
    <Tooltip label={`${goals} gol${goals !== 1 ? 'es' : ''}`} className="text-sm gap-0.5">
      <SoccerBallIcon className="w-4 h-4" />
      {goals}
    </Tooltip>
  );
}

export default function ExternalMatchPlayerList({
  title,
  roster,
  canEditParticipants,
  canEditGoals,
  saving,
  availablePlayers,
  moveDestinationsFor,
  onAddPlayer,
  onRemovePlayer,
  onSetGoals,
  hideWhenEmpty = false,
}: ExternalMatchPlayerListProps) {
  if (hideWhenEmpty && roster.length === 0 && !canEditParticipants) return null;

  const players = roster.map((r) => r.player);
  const maleCount = players.filter((p) => p.gender === 'male').length;
  const femaleCount = players.filter((p) => p.gender === 'female').length;
  const goalsByPlayer = new Map(roster.map((r) => [r.player.id, r.goals]));

  const sorted = [...roster].sort((a, b) => comparePlayersByGenderThenName(a.player, b.player));

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mt-6">
      <h3 className="font-bold text-lg mb-3">
        {title}
        <span className="font-normal text-sm text-muted ml-2">({players.length})</span>
      </h3>
      <ul className="space-y-1">
        {sorted.map(({ player }) => (
          <ParticipantRow
            key={player.id}
            player={player}
            canEdit={canEditParticipants}
            disabled={saving}
            moveDestinations={moveDestinationsFor(player)}
            onRemove={() => onRemovePlayer(player.id)}
            trailing={
              <GoalsControl
                goals={goalsByPlayer.get(player.id) ?? 0}
                canEdit={canEditGoals}
                saving={saving}
                onChange={(goals) => onSetGoals(player.id, goals)}
              />
            }
          />
        ))}
      </ul>
      {canEditParticipants && (
        <AddParticipantControl
          availablePlayers={availablePlayers}
          onAdd={onAddPlayer}
          disabled={saving}
        />
      )}
      {players.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border-subtle text-sm text-muted">
          <span>{players.length} jugador{players.length !== 1 ? 'es' : ''}</span>
          {' · '}
          <span>{maleCount}<GenderMaleIcon className="w-4 h-4 inline" /></span>
          {' '}
          <span>{femaleCount}<GenderFemaleIcon className="w-4 h-4 inline" /></span>
        </div>
      )}
    </div>
  );
}
