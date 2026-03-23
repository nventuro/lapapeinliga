import type { Player } from '../types';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';
import { isGuest } from '../types';

interface CoachAssignmentProps {
  players: Player[];
  coachIds: Set<number>;
  onToggleCoach: (id: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function CoachAssignment({
  players,
  coachIds,
  onToggleCoach,
  onConfirm,
  onBack,
}: CoachAssignmentProps) {
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const coachCount = coachIds.size;
  const attendeeCount = players.length - coachCount;
  const isValid = coachCount >= 1 && attendeeCount >= 1;

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Asignar entrenadores</h2>
      <p className="text-sm text-muted mb-4">
        Seleccioná quiénes van a ser entrenadores. El resto entrena.
      </p>

      <ul className="space-y-1 mb-4">
        {sorted.map((player) => {
          const isCoach = coachIds.has(player.id);
          return (
            <li
              key={player.id}
              onClick={() => onToggleCoach(player.id)}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                isCoach
                  ? 'bg-primary/20 ring-2 ring-primary'
                  : 'hover:bg-neutral'
              }`}
            >
              <GenderIcon gender={player.gender} />
              <span className="flex-1">{player.name}</span>
              {isGuest(player) && <InvBadge />}
              <span className="text-xs text-muted">
                {isCoach ? 'Entrenador' : 'Jugador'}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="text-sm text-muted mb-4">
        {coachCount} entrenador{coachCount !== 1 ? 'es' : ''} · {attendeeCount} jugador{attendeeCount !== 1 ? 'es' : ''}
      </div>

      {!isValid && (
        <p className="text-sm text-error mb-3">
          Se necesita al menos 1 entrenador y 1 jugador.
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-lg font-medium text-muted hover:text-muted-strong transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={onConfirm}
          disabled={!isValid}
          className="flex-1 py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}
