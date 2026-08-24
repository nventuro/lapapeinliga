import { useEffect, useState } from 'react';
import type { AwardResult, AwardType, EventAwardWindow, EventType, Player } from '../types';
import { AWARD_DESCRIPTIONS, AWARD_LABELS, AWARD_TYPES, hasAwards } from '../types';
import { AWARD_ICONS } from './awardIcons';
import { useAppContext, useCurrentPlayer } from '../context/appContext';
import { formatDateTime } from '../utils/dateUtils';
import TiebreakerDialog from './TiebreakerDialog';
import FeedbackInput from './FeedbackInput';
import SectionLabel from './SectionLabel';
import Skeleton from './Skeleton';

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
  feedbackBody: string | null;
  feedbackLoading: boolean;
  onSubmitFeedback: (body: string) => Promise<void>;
  onClearFeedback: () => Promise<void>;
}

function formatTimeRemaining(iso: string, now: Date): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  if (diffMs <= 0) return 'cerrando…';
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** The results rows with the winners blank, for while the votes are counted. */
function ResultsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-2 text-sm">
      <span className="sr-only">Cargando…</span>
      {AWARD_TYPES.map((award) => {
        const Icon = AWARD_ICONS[award];
        return (
          <div key={award} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted">
              {AWARD_LABELS[award]}
              <Icon className="w-4 h-4 text-muted" />
            </span>
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        );
      })}
    </div>
  );
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
  feedbackBody,
  feedbackLoading,
  onSubmitFeedback,
  onClearFeedback,
}: AwardsSectionProps) {
  const { isAdmin } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const [savingAward, setSavingAward] = useState<AwardType | null>(null);
  const [tiebreakerOpen, setTiebreakerOpen] = useState<{ award: AwardType; candidates: Player[] } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (voteWindow?.state !== 'open') return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [voteWindow?.state]);

  if (!hasAwards(eventType)) return null;
  if (voteWindow?.state === 'n/a') return null;

  // No window yet means it is still on its way (or failed): hold the card's
  // place so the page does not grow by a section when it lands.
  if (!voteWindow) {
    if (!loading) return null;
    return (
      <div className="mt-4">
        <SectionLabel dim>PREMIOS</SectionLabel>
        <div className="bg-surface border border-border rounded-lg p-4">
          <ResultsSkeleton />
        </div>
      </div>
    );
  }

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
      <div className="mt-4">
        <SectionLabel dim>PREMIOS</SectionLabel>
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm text-muted">
            La votación abre {voteWindow.opens_at ? `el ${formatDateTime(voteWindow.opens_at)}` : 'próximamente'}.
          </p>
        </div>
      </div>
    );
  }

  // ─── OPEN: voting window active ────────────────────────────────────────
  if (voteWindow.state === 'open') {
    const timeLeft = voteWindow.closes_at ? formatTimeRemaining(voteWindow.closes_at, now) : '';

    return (
      <div className="mt-4">
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel dim className="">VOTACIÓN DE PREMIOS</SectionLabel>
          <span className="text-xs text-muted">Cierra en {timeLeft}</span>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          {voteWindow.voter_count > 0 && (
            <p className="text-xs text-muted mb-1">
              {voteWindow.voter_count === 1 ? '1 persona votó' : `${voteWindow.voter_count} personas votaron`}
            </p>
          )}
          <p className="text-xs text-muted mb-4">
            Los votos son secretos. Los resultados se muestran una vez que cierra la votación.
          </p>

          {!currentPlayer ? (
            <p className="text-sm">
              Tu cuenta no está vinculada a un jugador. Buscá el link de invitación en el grupo de WhatsApp para poder votar.
            </p>
          ) : (
            <div className="space-y-4">
              {AWARD_TYPES.map((award) => {
                const Icon = AWARD_ICONS[award];
                const currentVote = myVotes.get(award) ?? null;
                const isSaving = savingAward === award;
                return (
                  <div key={award}>
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                      {AWARD_LABELS[award]}
                      <Icon className={`w-4 h-4 ${currentVote != null ? 'text-lime-strong' : 'text-muted'}`} />
                    </label>
                    <p className="text-xs text-muted mb-1">{AWARD_DESCRIPTIONS[award]}</p>
                    <select
                      value={currentVote ?? ''}
                      onChange={(e) => handleVoteChange(award, e.target.value)}
                      disabled={isSaving}
                      className={`w-full px-3 py-2 rounded-lg border bg-surface text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${currentVote != null ? 'border-lime-strong' : 'border-border'}`}
                    >
                      <option value="">Sin voto</option>
                      {sortedParticipants.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {myVotes.size > 0 && (
                <p className="text-xs text-muted italic">
                  Tus votos ya fueron registrados. Podés cambiarlos hasta que cierre la votación.
                </p>
              )}

              <div className="border-t border-border pt-4">
                <FeedbackInput
                  savedBody={feedbackBody}
                  loading={feedbackLoading}
                  onSubmit={onSubmitFeedback}
                  onClear={onClearFeedback}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── CLOSED: show results ──────────────────────────────────────────────
  return (
    <>
      <div className="mt-4">
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel dim className="">PREMIOS</SectionLabel>
          {voteWindow.voter_count > 0 && (
            <span className="text-xs text-muted">
              {voteWindow.voter_count === 1 ? '1 voto' : `${voteWindow.voter_count} votos`}
            </span>
          )}
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          {loading && results.length === 0 ? (
            <ResultsSkeleton />
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
                      <Icon className={`w-4 h-4 ${hasWinner ? 'text-lime-strong' : 'text-muted'}`} />
                    </span>
                    <span className="font-medium">
                      {state === 'winner' && result?.winner_id != null && getPlayerName(result.winner_id)}
                      {state === 'tied' && isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenTiebreaker(award)}
                          className="text-accent hover:text-accent-hover underline underline-offset-2"
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
