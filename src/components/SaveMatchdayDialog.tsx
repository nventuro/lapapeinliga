import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Team, Player } from '../types';
import { supabase } from '../lib/supabase';
import { formatDateShort } from '../utils/dateUtils';

function nextSaturday(): string {
  const today = new Date();
  const day = today.getDay();
  // Days until Saturday: (6 - day) % 7, but if today is Saturday use today
  const diff = (6 - day + 7) % 7;
  const sat = new Date(today);
  sat.setDate(today.getDate() + (diff === 0 ? 0 : diff));
  return sat.toISOString().slice(0, 10);
}

interface SaveMatchdayDialogProps {
  teams: Team[];
  reserves: Player[];
  onClose: () => void;
}

export default function SaveMatchdayDialog({ teams, reserves, onClose }: SaveMatchdayDialogProps) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [date, setDate] = useState(nextSaturday);
  const [teamNames, setTeamNames] = useState(() => teams.map((t) => t.name));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  function handleTeamNameChange(index: number, value: string) {
    setTeamNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedNames = teamNames.map((n) => n.trim());
    if (trimmedNames.some((n) => n === '')) {
      setError('Todos los equipos deben tener un nombre.');
      return;
    }

    setSaving(true);

    // 1. Insert matchday
    const { data: matchday, error: matchdayError } = await supabase
      .from('matchdays')
      .insert({ played_at: date })
      .select('id')
      .single();

    if (matchdayError || !matchday) {
      setError(matchdayError?.message ?? 'Error al crear la fecha.');
      setSaving(false);
      return;
    }

    // 2. Insert teams
    const teamInserts = trimmedNames.map((name) => ({
      matchday_id: matchday.id,
      name,
    }));

    const { data: insertedTeams, error: teamsError } = await supabase
      .from('matchday_teams')
      .insert(teamInserts)
      .select('id');

    if (teamsError || !insertedTeams) {
      setError(teamsError?.message ?? 'Error al crear los equipos.');
      setSaving(false);
      return;
    }

    // 3. Insert team players
    const playerInserts = insertedTeams.flatMap((dbTeam, i) =>
      teams[i].players.map((p) => ({
        matchday_team_id: dbTeam.id,
        player_id: p.id,
      })),
    );

    if (playerInserts.length > 0) {
      const { error: playersError } = await supabase
        .from('matchday_team_players')
        .insert(playerInserts);

      if (playersError) {
        setError(playersError.message);
        setSaving(false);
        return;
      }
    }

    // 4. Insert reserves
    if (reserves.length > 0) {
      const reserveInserts = reserves.map((p) => ({
        matchday_id: matchday.id,
        player_id: p.id,
      }));

      const { error: reservesError } = await supabase
        .from('matchday_reserves')
        .insert(reserveInserts);

      if (reservesError) {
        setError(reservesError.message);
        setSaving(false);
        return;
      }
    }

    navigate(`/matchdays/${matchday.id}`);
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto bg-surface text-on-surface rounded-xl shadow-xl p-0 w-full max-w-md backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={handleSave} className="p-6">
        <h2 className="text-xl font-bold mb-4">Guardar fecha</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary opacity-0 absolute inset-0"
              />
              <div className="px-3 py-2 rounded-lg border border-border bg-surface text-on-surface cursor-pointer">
                {formatDateShort(date)}
              </div>
            </div>
          </div>

          {teamNames.map((name, i) => (
            <div key={i} className="border border-border rounded-lg p-3">
              <input
                type="text"
                value={name}
                onChange={(e) => handleTeamNameChange(i, e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
              <ul className="mt-2 text-sm text-muted space-y-0.5">
                {teams[i].players.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-error mt-3">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
