import type { ExternalMatch } from '../types';
import { externalMatchResult } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';

interface ExternalMatchHeadToHeadProps {
  externalTeamId: number;
  opponentName: string;
  /** Changing this re-fetches the record (e.g. after the current score changes). */
  refreshToken: string;
}

type Tally = { wins: number; draws: number; losses: number; played: number };

function tally(matches: ExternalMatch[]): Tally {
  const t: Tally = { wins: 0, draws: 0, losses: 0, played: 0 };
  for (const m of matches) {
    const result = externalMatchResult(m.our_score, m.their_score);
    if (!result) continue;
    t.played++;
    if (result === 'win') t.wins++;
    else if (result === 'draw') t.draws++;
    else t.losses++;
  }
  return t;
}

export default function ExternalMatchHeadToHead({
  externalTeamId,
  opponentName,
  refreshToken,
}: ExternalMatchHeadToHeadProps) {
  const { data: record } = useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('external_matches')
      .select('id, event_id, external_team_id, our_score, their_score')
      .eq('external_team_id', externalTeamId);
    if (error) throw new Error(error.message);
    return tally(data as ExternalMatch[]);
  }, [externalTeamId, refreshToken]);

  if (!record || record.played === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mt-4">
      <h3 className="font-bold text-lg mb-3">Historial vs {opponentName}</h3>
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="font-bold text-success tabular-nums">{record.wins}</span>
          <span className="text-muted">ganados</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold text-info tabular-nums">{record.draws}</span>
          <span className="text-muted">empatados</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold text-error tabular-nums">{record.losses}</span>
          <span className="text-muted">perdidos</span>
        </span>
      </div>
    </div>
  );
}
