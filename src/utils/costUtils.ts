import { COST_MARKUP_MULTIPLIER, COST_ROUNDING_NEAREST } from '../types';

export function formatPesos(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('es-AR');
}

export function roundUpToNearest(amount: number, nearest: number): number {
  return Math.ceil(amount / nearest) * nearest;
}

export function perPlayerCost(totalCost: number, playerCount: number): number {
  return roundUpToNearest(
    (totalCost * COST_MARKUP_MULTIPLIER) / playerCount,
    COST_ROUNDING_NEAREST,
  );
}
