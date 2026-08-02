import { useState } from 'react';
import type { ExternalMatch } from '../types';
import { EXTERNAL_RESULT_LABELS, OUR_TEAM_NAME, externalMatchResult } from '../types';
import Confetti from './Confetti';

interface ExternalMatchScoreCardProps {
  match: ExternalMatch;
  opponentName: string;
  canEdit: boolean;
  saving: boolean;
  glowing: boolean;
  onSave: (ourScore: number | null, theirScore: number | null) => void;
}

function scoreToInput(value: number | null): string {
  return value == null ? '' : String(value);
}

export default function ExternalMatchScoreCard({
  match,
  opponentName,
  canEdit,
  saving,
  glowing,
  onSave,
}: ExternalMatchScoreCardProps) {
  const [ourInput, setOurInput] = useState(() => scoreToInput(match.our_score));
  const [theirInput, setTheirInput] = useState(() => scoreToInput(match.their_score));

  // Resync when the record changes underneath us (another admin saved a score,
  // or a participant edit reloaded the event); otherwise "Guardar" would
  // silently overwrite their result with our stale initial values. This is the
  // render-time "adjust state when props change" pattern from the React docs.
  const [syncedScores, setSyncedScores] = useState({ our: match.our_score, their: match.their_score });
  if (syncedScores.our !== match.our_score || syncedScores.their !== match.their_score) {
    setSyncedScores({ our: match.our_score, their: match.their_score });
    setOurInput(scoreToInput(match.our_score));
    setTheirInput(scoreToInput(match.their_score));
  }

  const result = externalMatchResult(match.our_score, match.their_score);
  const resultLabel = result ? EXTERNAL_RESULT_LABELS[result] : 'Sin jugar';
  const resultColor = result === 'win' ? 'text-success'
    : result === 'loss' ? 'text-error'
    : result === 'draw' ? 'text-info'
    : 'text-muted';

  function handleSave() {
    const our = ourInput.trim() === '' ? null : parseInt(ourInput.trim(), 10);
    const their = theirInput.trim() === '' ? null : parseInt(theirInput.trim(), 10);
    onSave(our, their);
  }

  function handleClear() {
    setOurInput('');
    setTheirInput('');
    onSave(null, null);
  }

  // Either both scores are filled or both are empty; a half-filled score is invalid.
  const ourFilled = ourInput.trim() !== '';
  const theirFilled = theirInput.trim() !== '';
  const valid = ourFilled === theirFilled;

  const won = result === 'win';

  return (
    <div className={`relative overflow-hidden rounded-lg p-4 mt-4 ${won ? 'border-2 border-lime bg-lime-subtle' : 'bg-surface border border-border'} ${glowing ? 'animate-lime-glow-pulse' : ''}`}>
      {won && <Confetti />}
      <h3 className="font-bold text-lg mb-4">Resultado</h3>

      <div className="flex items-center justify-center gap-3 text-center">
        <span className="flex-1 font-medium text-right">{OUR_TEAM_NAME}</span>
        {canEdit ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              inputMode="numeric"
              value={ourInput}
              onChange={(e) => setOurInput(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={saving}
              placeholder="-"
              className="w-12 px-2 py-2 text-center rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-muted">-</span>
            <input
              type="text"
              inputMode="numeric"
              value={theirInput}
              onChange={(e) => setTheirInput(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={saving}
              placeholder="-"
              className="w-12 px-2 py-2 text-center rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        ) : (
          <span className="shrink-0 text-xl font-bold tabular-nums">
            {match.our_score ?? '-'} <span className="text-muted">-</span> {match.their_score ?? '-'}
          </span>
        )}
        <span className="flex-1 font-medium text-left">{opponentName}</span>
      </div>

      <p className={`text-center mt-3 font-medium ${resultColor}`}>{resultLabel}</p>

      {canEdit && (
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={handleClear}
            disabled={saving || (!ourFilled && !theirFilled)}
            className="flex-1 py-2 rounded-lg font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Borrar resultado
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !valid}
            className="flex-1 py-2 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors text-sm"
          >
            {saving ? 'Guardando...' : 'Guardar resultado'}
          </button>
        </div>
      )}
    </div>
  );
}
