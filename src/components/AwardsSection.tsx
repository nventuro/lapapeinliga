import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AwardResult, AwardType, EventAwardWindow, EventType, Player } from '../types';
import { AWARD_LABELS, AWARD_TYPES } from '../types';
import { AWARD_ICONS } from './awardIcons';
import { useAppContext, useCurrentPlayer } from '../context/appContext';
import TiebreakerDialog from './TiebreakerDialog';

interface AwardsSectionProps {
  eventType: EventType;
  participants: Player[];
  voteWindow: EventAwardWindow | null;
  results: AwardResult[];
  myVotes: Map<AwardType, number>;
  loading: boolean;
  onCastVote: (award: AwardType, candidateId: number) => Promise<void>;
  onClearVote: (award: AwardType) => Promise<void>;
  onResolveTie: (award: AwardType, chosenId: number) => Promise<void>;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeRemaining(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  if (diffMs <= 0) return 'cerrando…';
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AwardsSection({
  eventType,
  participants,
  voteWindow,
  results,
  myVotes,
  loading,
  onCastVote,
  onClearVote,
  onResolveTie,
}: AwardsSectionProps) {
  const { isAdmin } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const [savingAward, setSavingAward] = useState<AwardType | null>(null);
  const [tiebreakerOpen, setTiebreakerOpen] = useState<{ award: AwardType; candidates: Player[] } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (voteWindow?.state !== 'open') return;
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, [voteWindow?.state]);

  if (eventType === 'training') return null;
  if (!voteWindow || voteWindow.state === 'n/a') return null;

  function findResult(award: AwardType): AwardResult | undefined {
    return results.find((r) => r.award_type === award);
  }

  function getPlayerName(id: number): string {
    return participants.find((p) => p.id === id)?.name ?? '';
  }

  async function handleVoteChange(award: AwardType, value: string) {
    setSavingAward(award);
    try {
      if (value === '') {
        if (myVotes.has(award)) {
          await onClearVote(award);
        }
      } else {
        await onCastVote(award, Number(value));
      }
    } catch {
      // RPC errors surface via the hook's error state; per-row surfacing
      // can be added later if needed.
    }
    setSavingAward(null);
  }

  function handleOpenTiebreaker(award: AwardType) {
    const result = findResult(award);
    if (!result || result.state !== 'tied' || !result.tied_candidates) return;
    const candidates = participants.filter((p) => result.tied_candidates!.includes(p.id));
    setTiebreakerOpen({ award, candidates });
  }

  const sortedParticipants = [...participants].sort((a, b) => a.name.localeCompare(b.name));

  // ─── PENDING: window hasn't opened yet ─────────────────────────────────
  if (voteWindow.state === 'pending') {
    return (
      <div className="border border-border rounded-lg p-4 mt-4">
        <h3 className="font-bold text-lg mb-2">Premios</h3>
        <p className="text-sm text-muted">
          La votación abre {voteWindow.opens_at ? `el ${formatDateTime(voteWindow.opens_at)}hs` : 'próximamente'}.
        </p>
      </div>
    );
  }

  // ─── OPEN: voting window active ────────────────────────────────────────
  if (voteWindow.state === 'open') {
    const timeLeft = voteWindow.closes_at ? formatTimeRemaining(voteWindow.closes_at, now) : '';

    return (
      <div className="border border-border rounded-lg p-4 mt-4">
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="font-bold text-lg">Votación abierta</h3>
          <span className="text-xs text-muted">Cierra en {timeLeft}</span>
        </div>
        <p className="text-xs text-muted mb-4">
          Los votos son secretos. Los resultados se muestran una vez que cierra la votación.
        </p>

        {!currentPlayer ? (
          <div className="text-sm">
            <p className="mb-2">Tenés que vincular tu cuenta a un jugador para votar.</p>
            <Link to="/claim" className="text-primary hover:text-primary-hover underline underline-offset-2">
              Vincular cuenta
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {AWARD_TYPES.map((award) => {
              const Icon = AWARD_ICONS[award];
              const currentVote = myVotes.get(award) ?? null;
              const isSaving = savingAward === award;
              return (
                <div key={award}>
                  <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                    {AWARD_LABELS[award]}
                    <Icon className={`w-4 h-4 ${currentVote != null ? 'text-gold' : 'text-muted'}`} />
                  </label>
                  <select
                    value={currentVote ?? ''}
                    onChange={(e) => handleVoteChange(award, e.target.value)}
                    disabled={isSaving}
                    className={`w-full px-3 py-2 rounded-lg border bg-surface text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${currentVote != null ? 'border-gold' : 'border-border'}`}
                  >
                    <option value="">Sin voto</option>
                    {sortedParticipants.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── CLOSED: show results ──────────────────────────────────────────────
  return (
    <>
      <div className="border border-border rounded-lg p-4 mt-4">
        <h3 className="font-bold text-lg mb-4">Premios</h3>
        {loading && results.length === 0 ? (
          <p className="text-sm text-muted">Cargando...</p>
        ) : (
          <div className="space-y-2 text-sm">
            {AWARD_TYPES.map((award) => {
              const Icon = AWARD_ICONS[award];
              const result = findResult(award);
              const state = result?.state ?? 'no_votes';
              const hasWinner = state === 'winner';

              return (
                <div key={award} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted">
                    {AWARD_LABELS[award]}
                    <Icon className={`w-4 h-4 ${hasWinner ? 'text-gold' : 'text-muted'}`} />
                  </span>
                  <span className="font-medium">
                    {state === 'winner' && result?.winner_id != null && getPlayerName(result.winner_id)}
                    {state === 'tied' && isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenTiebreaker(award)}
                        className="text-primary hover:text-primary-hover underline underline-offset-2"
                      >
                        Resolver empate
                      </button>
                    )}
                    {state === 'tied' && !isAdmin && (
                      <span className="text-muted italic">Empate — pendiente</span>
                    )}
                    {state === 'no_votes' && <span className="text-muted italic">Sin votos</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {tiebreakerOpen && (
        <TiebreakerDialog
          award={tiebreakerOpen.award}
          tiedCandidates={tiebreakerOpen.candidates}
          onResolve={(playerId) => onResolveTie(tiebreakerOpen.award, playerId)}
          onClose={() => setTiebreakerOpen(null)}
        />
      )}
    </>
  );
}
