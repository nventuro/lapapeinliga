import type { Player, AwardType } from '../types';
import { AWARD_LABELS, AWARD_TYPES } from '../types';
import { TrophyIcon } from './icons';
import { AWARD_ICONS } from './awardIcons';

interface ResultsSectionProps {
  winningTeamId: number | null;
  teams: { id: number; name: string }[];
  participants: Player[];
  awardValues: Record<AwardType, number | null>;
  winnerTeamName: string | null;
  isAdmin: boolean;
  saving: boolean;
  glowingWinner: boolean;
  glowingAwards: Set<AwardType>;
  onWinnerChange: (teamId: number | null) => void;
  onAwardChange: (award: AwardType, playerId: number | null) => void;
  getPlayerName: (id: number | null) => string;
}

export default function ResultsSection({
  winningTeamId,
  teams,
  participants,
  awardValues,
  winnerTeamName,
  isAdmin,
  saving,
  glowingWinner,
  glowingAwards,
  onWinnerChange,
  onAwardChange,
  getPlayerName,
}: ResultsSectionProps) {
  return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <h3 className="font-bold text-lg mb-4">Resultados</h3>

      {isAdmin ? (
        <div className="space-y-4">
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

          {AWARD_TYPES.map((award) => {
            const Icon = AWARD_ICONS[award];
            const isGranted = awardValues[award] != null;
            const isGlowing = glowingAwards.has(award);
            return (
              <div key={award}>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                  {AWARD_LABELS[award]}
                  <Icon className={`w-4 h-4 ${isGranted ? 'text-gold' : 'text-muted'}`} />
                </label>
                <select
                  value={awardValues[award] ?? ''}
                  onChange={(e) => onAwardChange(award, e.target.value ? Number(e.target.value) : null)}
                  disabled={saving}
                  className={`w-full px-3 py-2 rounded-lg border bg-surface text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${isGranted ? 'border-gold' : 'border-border'} ${isGlowing ? 'animate-gold-glow-pulse' : ''}`}
                >
                  <option value="">Sin definir</option>
                  {[...participants].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted">
              Ganador
              <TrophyIcon className={`w-4 h-4 ${winningTeamId ? 'text-gold' : 'text-muted'}`} />
            </span>
            <span className="font-medium">
              {winnerTeamName ?? 'Sin definir'}
            </span>
          </div>
          {AWARD_TYPES.map((award) => {
            const Icon = AWARD_ICONS[award];
            const isGranted = awardValues[award] != null;
            return (
              <div key={award} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted">
                  {AWARD_LABELS[award]}
                  <Icon className={`w-4 h-4 ${isGranted ? 'text-gold' : 'text-muted'}`} />
                </span>
                <span className="font-medium">
                  {getPlayerName(awardValues[award]) || 'Sin definir'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
