import { COST_MARKUP_MULTIPLIER, COST_ROUNDING_NEAREST } from '../types';

export function formatPesos(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('es-AR');
}

export function roundUpToNearest(amount: number, nearest: number): number {
  return Math.ceil(amount / nearest) * nearest;
}

/** Per-player share of a cost, or null when there is nobody to split it among. */
export function perPlayerCost(totalCost: number, playerCount: number): number | null {
  if (playerCount <= 0) return null;
  return roundUpToNearest(
    (totalCost * COST_MARKUP_MULTIPLIER) / playerCount,
    COST_ROUNDING_NEAREST,
  );
}

export type CostParseResult = { value: number | null; error: null } | { value: null; error: string };

/**
 * Parses a user-typed peso amount. Strips es-AR digit separators ("15.000",
 * "15,000") instead of letting parseInt truncate them to 15, and rejects any
 * other non-numeric input instead of silently producing NaN (which would
 * serialize to null and drop the cost).
 */
export function parseCostInput(raw: string): CostParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: null };
  const cleaned = trimmed.replace(/[.,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) {
    return { value: null, error: 'El costo tiene que ser un número (ej: 15000).' };
  }
  return { value: parseInt(cleaned, 10), error: null };
}
