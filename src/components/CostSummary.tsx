import type { EventFinances } from '../types';
import { COST_MARKUP_MULTIPLIER } from '../types';
import { formatPesos, perPlayerCost } from '../utils/costUtils';

interface CostSummaryProps {
  finances: EventFinances | null;
  participantCount: number;
  className?: string;
}

/**
 * The Total / Inflado / Por jugador / Pagó cost row. Single source for both
 * the event list and the event detail page — callers gate visibility
 * (admin + showCosts); this only decides what a cost looks like.
 */
export default function CostSummary({ finances, participantCount, className = '' }: CostSummaryProps) {
  if (finances?.cost == null) return null;
  const { cost, payee_alias_cbu } = finances;
  const perPlayer = perPlayerCost(cost, participantCount);

  return (
    <p className={`text-muted flex flex-wrap gap-x-3 ${className}`}>
      <span>Total: {formatPesos(cost)}</span>
      <span>Inflado: {formatPesos(cost * COST_MARKUP_MULTIPLIER)}</span>
      {perPlayer != null && <span>Por jugador: {formatPesos(perPlayer)}</span>}
      {payee_alias_cbu && <span>Pagó: {payee_alias_cbu}</span>}
    </p>
  );
}
