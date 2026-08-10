import { useState } from 'react';
import type { ExternalMatch } from '../types';
import { EXTERNAL_RESULT_LABELS, OUR_TEAM_NAME, externalMatchResult, isExternalWin } from '../types';
import Confetti from './Confetti';

interface ExternalMatchScoreCardProps {
  match: ExternalMatch;
  opponentName: string;
  canEdit: boolean;
  saving: boolean;
  glowing: boolean;
  onSave: (
    ourScore: number | null,
    theirScore: number | null,
    ourPenalties: number | null,
    theirPenalties: number | null,
  ) => void;
}

function scoreToInput(value: number | null): string {
  return value == null ? '' : String(value);
}

function inputToScore(value: string): number | null {
  return value.trim() === '' ? null : parseInt(value.trim(), 10);
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
  const [ourPenInput, setOurPenInput] = useState(() => scoreToInput(match.our_penalties));
  const [theirPenInput, setTheirPenInput] = useState(() => scoreToInput(match.their_penalties));

  // Resync when the record changes underneath us (another admin saved a score,
  // or a participant edit reloaded the event); otherwise "Guardar" would
  // silently overwrite their result with our stale initial values. This is the
  // render-time "adjust state when props change" pattern from the React docs.
  const [synced, setSynced] = useState({
    our: match.our_score,
    their: match.their_score,
    ourPen: match.our_penalties,
    theirPen: match.their_penalties,
  });
  if (
    synced.our !== match.our_score || synced.their !== match.their_score
    || synced.ourPen !== match.our_penalties || synced.theirPen !== match.their_penalties
  ) {
    setSynced({
      our: match.our_score,
      their: match.their_score,
      ourPen: match.our_penalties,
      theirPen: match.their_penalties,
    });
    setOurInput(scoreToInput(match.our_score));
    setTheirInput(scoreToInput(match.their_score));
    setOurPenInput(scoreToInput(match.our_penalties));
    setTheirPenInput(scoreToInput(match.their_penalties));
  }

  const result = externalMatchResult(match.our_score, match.their_score, match.our_penalties, match.their_penalties);
  const resultLabel = result ? EXTERNAL_RESULT_LABELS[result] : 'Sin jugar';
  const resultColor = isExternalWin(result) ? 'text-success'
    : result === 'loss' || result === 'loss_penalties' ? 'text-error'
    : result === 'draw' ? 'text-info'
    : 'text-muted';

  // A shootout can only follow a tie, so the penalty inputs exist only while
  // the entered scores are level; leaving a tie discards whatever was typed.
  function setScore(which: 'our' | 'their', raw: string) {
    const value = raw.replace(/[^0-9]/g, '');
    const our = which === 'our' ? value : ourInput;
    const their = which === 'their' ? value : theirInput;
    if (which === 'our') setOurInput(value);
    else setTheirInput(value);
    if (inputToScore(our) == null || inputToScore(our) !== inputToScore(their)) {
      setOurPenInput('');
      setTheirPenInput('');
    }
  }

  function handleSave() {
    onSave(inputToScore(ourInput), inputToScore(theirInput), inputToScore(ourPenInput), inputToScore(theirPenInput));
  }

  function handleClear() {
    setOurInput('');
    setTheirInput('');
    setOurPenInput('');
    setTheirPenInput('');
    onSave(null, null, null, null);
  }

  // Either both scores are filled or both are empty; a half-filled score is invalid.
  const ourFilled = ourInput.trim() !== '';
  const theirFilled = theirInput.trim() !== '';
  const isTie = ourFilled && theirFilled && inputToScore(ourInput) === inputToScore(theirInput);

  // Penalties are optional even on a tie, but once started they must be
  // complete and must produce a winner.
  const ourPenFilled = ourPenInput.trim() !== '';
  const theirPenFilled = theirPenInput.trim() !== '';
  const penaltiesValid = isTie
    ? ourPenFilled === theirPenFilled && (!ourPenFilled || inputToScore(ourPenInput) !== inputToScore(theirPenInput))
    : !ourPenFilled && !theirPenFilled;
  const valid = ourFilled === theirFilled && penaltiesValid;

  const won = isExternalWin(result);
  const hasPenalties = match.our_penalties != null && match.their_penalties != null;

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
              onChange={(e) => setScore('our', e.target.value)}
              disabled={saving}
              placeholder="-"
              className="w-12 px-2 py-2 text-center rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-muted">-</span>
            <input
              type="text"
              inputMode="numeric"
              value={theirInput}
              onChange={(e) => setScore('their', e.target.value)}
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

      {canEdit && isTie && (
        <div className="flex items-center justify-center gap-3 text-center mt-2">
          <span className="flex-1 text-sm text-muted text-right">Penales</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              inputMode="numeric"
              value={ourPenInput}
              onChange={(e) => setOurPenInput(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={saving}
              placeholder="-"
              className="w-12 px-2 py-1.5 text-center text-sm rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-muted">-</span>
            <input
              type="text"
              inputMode="numeric"
              value={theirPenInput}
              onChange={(e) => setTheirPenInput(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={saving}
              placeholder="-"
              className="w-12 px-2 py-1.5 text-center text-sm rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <span className="flex-1" />
        </div>
      )}

      {!canEdit && hasPenalties && (
        <p className="text-center text-sm text-muted mt-1 tabular-nums">
          ({match.our_penalties} - {match.their_penalties} en los penales)
        </p>
      )}

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
