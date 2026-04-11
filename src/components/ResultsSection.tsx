import { TrophyIcon } from './icons';

interface ResultsSectionProps {
  winningTeamId: number | null;
  teams: { id: number; name: string }[];
  winnerTeamName: string | null;
  isAdmin: boolean;
  saving: boolean;
  glowingWinner: boolean;
  onWinnerChange: (teamId: number | null) => void;
}

export default function ResultsSection({
  winningTeamId,
  teams,
  winnerTeamName,
  isAdmin,
  saving,
  glowingWinner,
  onWinnerChange,
}: ResultsSectionProps) {
  return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <h3 className="font-bold text-lg mb-4">Resultado</h3>

      {isAdmin ? (
        <div>
          <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
            Ganador
            <TrophyIcon className={`w-4 h-4 ${winningTeamId ? 'text-gold' : 'text-muted'}`} />
          </label>
          <select
            value={winningTeamId ?? ''}
            onChange={(e) => onWinnerChange(e.target.value ? Number(e.target.value) : null)}
            disabled={saving}
            className={`w-full px-3 py-2 rounded-lg border bg-surface text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${winningTeamId ? 'border-gold' : 'border-border'} ${glowingWinner ? 'animate-gold-glow-pulse' : ''}`}
          >
            <option value="">Sin definir</option>
            {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted">
            Ganador
            <TrophyIcon className={`w-4 h-4 ${winningTeamId ? 'text-gold' : 'text-muted'}`} />
          </span>
          <span className="font-medium">
            {winnerTeamName ?? 'Sin definir'}
          </span>
        </div>
      )}
    </div>
  );
}
