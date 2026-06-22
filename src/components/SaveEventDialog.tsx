import { useState, useRef, useEffect } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useNavigate } from 'react-router-dom';
import type { Team, Player, ShirtColor, Location, LocationSelection, ExternalTeam, ExternalTeamSelection } from '../types';
import { isNewLocationComplete, isExternalTeamSelectionComplete } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDateShort, isValidTime } from '../utils/dateUtils';
import { shuffle } from '../utils/shuffle';
import { defaultTeamName } from '../utils/teamSorter';
import LocationPicker from './LocationPicker';
import ExternalTeamPicker from './ExternalTeamPicker';
import TimeInput from './TimeInput';
import TeamNameColorControls from './TeamNameColorControls';

function nextSaturday(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = (6 - day + 7) % 7;
  const sat = new Date(today);
  sat.setDate(today.getDate() + (diff === 0 ? 0 : diff));
  return sat.toISOString().slice(0, 10);
}

type SaveEventDialogProps = {
  onClose: () => void;
} & (
  | { type: 'match'; teams: Team[]; reserves: Player[] }
  | { type: 'tournament'; teams: Team[]; reserves: Player[] }
  | { type: 'training'; attendees: Player[]; coaches: Player[] }
  | { type: 'external_match'; roster: Player[]; reserves: Player[] }
);

function initialTeamNames(count: number, suggestedNames: string[]): string[] {
  const shuffled = shuffle(suggestedNames);
  return Array.from({ length: count }, (_, i) =>
    i < shuffled.length ? shuffled[i] : defaultTeamName(i),
  );
}

async function insertMatchChildren(
  eventId: number,
  teams: Team[],
  reserves: Player[],
  teamNames: string[],
  shirtColors: ShirtColor[],
): Promise<string | null> {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({ event_id: eventId })
    .select('id')
    .single();

  if (matchError || !match) return matchError?.message ?? 'Error al crear el partido.';

  const trimmedNames = teamNames.map((n) => n.trim());
  const { data: insertedTeams, error: teamsError } = await supabase
    .from('match_teams')
    .insert(trimmedNames.map((name, i) => ({ match_id: match.id, name, shirt_color: shirtColors[i] })))
    .select('id');

  if (teamsError || !insertedTeams) return teamsError?.message ?? 'Error al crear los equipos.';

  const playerInserts = insertedTeams.flatMap((dbTeam, i) =>
    teams[i].players.map((p) => ({ match_team_id: dbTeam.id, player_id: p.id })),
  );
  if (playerInserts.length > 0) {
    const { error } = await supabase.from('match_team_players').insert(playerInserts);
    if (error) return error.message;
  }

  if (reserves.length > 0) {
    const { error } = await supabase
      .from('match_reserves')
      .insert(reserves.map((p) => ({ match_id: match.id, player_id: p.id })));
    if (error) return error.message;
  }

  return null;
}

async function insertTournamentChildren(
  eventId: number,
  teams: Team[],
  reserves: Player[],
  teamNames: string[],
): Promise<string | null> {
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .insert({ event_id: eventId })
    .select('id')
    .single();

  if (tournamentError || !tournament) return tournamentError?.message ?? 'Error al crear el torneo.';

  const trimmedNames = teamNames.map((n) => n.trim());
  const { data: insertedTeams, error: teamsError } = await supabase
    .from('tournament_teams')
    .insert(trimmedNames.map((name) => ({ tournament_id: tournament.id, name })))
    .select('id');

  if (teamsError || !insertedTeams) return teamsError?.message ?? 'Error al crear los equipos.';

  const playerInserts = insertedTeams.flatMap((dbTeam, i) =>
    teams[i].players.map((p) => ({ tournament_team_id: dbTeam.id, player_id: p.id })),
  );
  if (playerInserts.length > 0) {
    const { error } = await supabase.from('tournament_team_players').insert(playerInserts);
    if (error) return error.message;
  }

  if (reserves.length > 0) {
    const { error } = await supabase
      .from('tournament_reserves')
      .insert(reserves.map((p) => ({ tournament_id: tournament.id, player_id: p.id })));
    if (error) return error.message;
  }

  return null;
}

async function insertTrainingChildren(
  eventId: number,
  attendees: Player[],
  coaches: Player[],
): Promise<string | null> {
  const { data: training, error: trainingError } = await supabase
    .from('trainings')
    .insert({ event_id: eventId })
    .select('id')
    .single();

  if (trainingError || !training) return trainingError?.message ?? 'Error al crear el entrenamiento.';

  if (attendees.length > 0) {
    const { error } = await supabase
      .from('training_attendees')
      .insert(attendees.map((p) => ({ training_id: training.id, player_id: p.id })));
    if (error) return error.message;
  }

  if (coaches.length > 0) {
    const { error } = await supabase
      .from('training_coaches')
      .insert(coaches.map((p) => ({ training_id: training.id, player_id: p.id })));
    if (error) return error.message;
  }

  return null;
}

async function insertExternalMatchChildren(
  eventId: number,
  externalTeamId: number,
  roster: Player[],
  reserves: Player[],
): Promise<string | null> {
  const { data: externalMatch, error: matchError } = await supabase
    .from('external_matches')
    .insert({ event_id: eventId, external_team_id: externalTeamId })
    .select('id')
    .single();

  if (matchError || !externalMatch) return matchError?.message ?? 'Error al crear el partido.';

  if (roster.length > 0) {
    const { error } = await supabase
      .from('external_match_players')
      .insert(roster.map((p) => ({ external_match_id: externalMatch.id, player_id: p.id })));
    if (error) return error.message;
  }

  if (reserves.length > 0) {
    const { error } = await supabase
      .from('external_match_reserves')
      .insert(reserves.map((p) => ({ external_match_id: externalMatch.id, player_id: p.id })));
    if (error) return error.message;
  }

  return null;
}

/** Resolves an opponent selection to an external_team id, creating it if new. */
async function resolveExternalTeamId(
  selection: ExternalTeamSelection,
): Promise<{ id: number } | { error: string }> {
  if (selection.type === 'existing') return { id: selection.externalTeamId };
  if (selection.type !== 'new') return { error: 'Elegí el rival.' };

  const name = selection.name.trim();
  if (!name) return { error: 'Completá el nombre del rival.' };

  // Reuse an existing opponent with the same name (case-insensitive) so the
  // head-to-head record doesn't fork; the DB has a matching unique index.
  const { data: existing } = await supabase
    .from('external_teams')
    .select('id')
    .ilike('name', name)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data: created, error } = await supabase
    .from('external_teams')
    .insert({ name })
    .select('id')
    .single();
  if (error || !created) return { error: error?.message ?? 'Error al crear el rival.' };
  return { id: created.id };
}

export default function SaveEventDialog(props: SaveEventDialogProps) {
  const { onClose } = props;
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  useBodyScrollLock();
  const { teamNames: suggestedTeamNames } = useAppContext();

  const [name, setName] = useState('');
  const [date, setDate] = useState(nextSaturday);
  const [time, setTime] = useState('');
  const [locationSelection, setLocationSelection] = useState<LocationSelection>({ type: 'none' });
  const [locations, setLocations] = useState<Location[]>([]);
  const [cost, setCost] = useState('');
  const [payee, setPayee] = useState('');
  const [externalTeams, setExternalTeams] = useState<ExternalTeam[]>([]);
  const [opponentSelection, setOpponentSelection] = useState<ExternalTeamSelection>({ type: 'none' });
  const hasTeams = props.type === 'match' || props.type === 'tournament';
  const [teamNames, setTeamNames] = useState(() =>
    hasTeams ? initialTeamNames(props.teams.length, suggestedTeamNames) : [],
  );
  const [shirtColors, setShirtColors] = useState<ShirtColor[]>(() =>
    props.type === 'match' ? props.teams.map((_, i) => (i % 2 === 0 ? 'light' : 'dark')) : [],
  );
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

  useEffect(() => {
    supabase.from('locations').select('*').order('name').then(({ data }) => {
      if (data) setLocations(data as Location[]);
    });
  }, []);

  useEffect(() => {
    if (props.type !== 'external_match') return;
    supabase.from('external_teams').select('id, name').order('name').then(({ data }) => {
      if (data) setExternalTeams(data as ExternalTeam[]);
    });
  }, [props.type]);

  function handleTeamNameChange(index: number, value: string) {
    setTeamNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleRandomizeName(index: number) {
    if (suggestedTeamNames.length === 0) return;
    setTeamNames((prev) => {
      const usedByOthers = new Set(prev.filter((_, j) => j !== index));
      const available = suggestedTeamNames.filter((n) => !usedByOthers.has(n));
      if (available.length === 0) return prev;
      const next = [...prev];
      next[index] = available[Math.floor(Math.random() * available.length)];
      return next;
    });
  }

  function handleShirtColorToggle(index: number) {
    setShirtColors((prev) => {
      const next = [...prev];
      next[index] = next[index] === 'light' ? 'dark' : 'light';
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (props.type === 'match' || props.type === 'tournament') {
      const trimmedNames = teamNames.map((n) => n.trim());
      if (trimmedNames.some((n) => n === '')) {
        setError('Todos los equipos deben tener un nombre.');
        return;
      }
    }

    if (props.type === 'external_match' && !isExternalTeamSelectionComplete(opponentSelection)) {
      setError('Elegí el rival.');
      return;
    }

    if (!time || !isValidTime(time)) {
      setError('Completá el horario.');
      return;
    }

    setSaving(true);

    // Resolve opponent (external matches only), before creating the event.
    let externalTeamId: number | null = null;
    if (props.type === 'external_match') {
      const resolved = await resolveExternalTeamId(opponentSelection);
      if ('error' in resolved) {
        setError(resolved.error);
        setSaving(false);
        return;
      }
      externalTeamId = resolved.id;
    }

    // 1. Resolve location (optional)
    let locationId: number | null = null;
    if (locationSelection.type === 'existing') {
      locationId = locationSelection.locationId;
    } else if (locationSelection.type === 'new') {
      if (!locationSelection.name.trim() || !locationSelection.mapsUrl.trim()) {
        setError('Completá el nombre y el link de Google Maps de la cancha.');
        setSaving(false);
        return;
      }
      const { data: newLoc, error: locError } = await supabase
        .from('locations')
        .insert({ name: locationSelection.name.trim(), maps_url: locationSelection.mapsUrl.trim() })
        .select('id')
        .single();

      if (locError || !newLoc) {
        setError(locError?.message ?? 'Error al crear la cancha.');
        setSaving(false);
        return;
      }
      locationId = newLoc.id;
    }

    // 2. Insert event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        name: name.trim() || null,
        type: props.type,
        played_at: date,
        played_at_time: time,
        location_id: locationId,
      })
      .select('id, short_id')
      .single();

    if (eventError || !event) {
      setError(eventError?.message ?? 'Error al crear la fecha.');
      setSaving(false);
      return;
    }

    // Financial details live in the mod/admin-only event_finances table.
    const costValue = cost.trim() ? parseInt(cost.trim(), 10) : null;
    const payeeValue = payee.trim() || null;
    if (costValue != null || payeeValue != null) {
      const { error: financesError } = await supabase
        .from('event_finances')
        .insert({ event_id: event.id, cost: costValue, payee_alias_cbu: payeeValue });
      if (financesError) {
        await supabase.from('events').delete().eq('id', event.id);
        setError(financesError.message);
        setSaving(false);
        return;
      }
    }

    // Insert child records. If any step fails, delete the event (cascades to all children).
    const childError =
      props.type === 'match' ? await insertMatchChildren(event.id, props.teams, props.reserves, teamNames, shirtColors)
      : props.type === 'tournament' ? await insertTournamentChildren(event.id, props.teams, props.reserves, teamNames)
      : props.type === 'external_match' ? await insertExternalMatchChildren(event.id, externalTeamId!, props.roster, props.reserves)
      : await insertTrainingChildren(event.id, props.attendees, props.coaches);
    if (childError) {
      await supabase.from('events').delete().eq('id', event.id);
      setError(childError);
      setSaving(false);
      return;
    }

    navigate(`/fechas/${event.short_id}`);
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto bg-surface text-on-surface rounded-xl shadow-xl p-0 w-full max-w-md backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) props.onClose();
      }}
    >
      <form onSubmit={handleSave} className="p-6">
        <h2 className="text-xl font-bold mb-4">
          {props.type === 'match' ? 'Guardar partido'
            : props.type === 'tournament' ? 'Guardar torneo'
            : props.type === 'external_match' ? 'Guardar partido externo'
            : 'Guardar entrenamiento'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Copa de Verano"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {props.type === 'external_match' && (
            <div>
              <label className="block text-sm font-medium mb-1">Rival</label>
              <ExternalTeamPicker
                value={opponentSelection}
                onChange={setOpponentSelection}
                teams={externalTeams}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <div>
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="sr-only"
              />
              <div
                onClick={() => dateInputRef.current?.showPicker()}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-on-surface cursor-pointer"
              >
                {formatDateShort(date)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Horario</label>
            <TimeInput value={time} onChange={setTime} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cancha (opcional)</label>
            <LocationPicker
              value={locationSelection}
              onChange={setLocationSelection}
              locations={locations}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Costo</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 15000"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Alias/CBU de quien pagó</label>
            <input
              type="text"
              placeholder="Alias o CBU"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {hasTeams && teamNames.map((teamName, i) => (
            <div key={i} className="border border-border rounded-lg p-3">
              <TeamNameColorControls
                name={teamName}
                onNameChange={(value) => handleTeamNameChange(i, value)}
                shirtColor={props.type === 'match' ? shirtColors[i] : undefined}
                onShirtColorToggle={() => handleShirtColorToggle(i)}
                onRandomize={suggestedTeamNames.length > 0 ? () => handleRandomizeName(i) : undefined}
                required
              />
              <ul className="mt-2 text-sm text-muted space-y-0.5">
                {props.teams[i].players.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            </div>
          ))}

          {props.type === 'external_match' && (
            <>
              <div className="border border-border rounded-lg p-3">
                <h3 className="text-sm font-medium mb-2">Titulares ({props.roster.length})</h3>
                <ul className="text-sm text-muted space-y-0.5">
                  {[...props.roster].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              </div>
              {props.reserves.length > 0 && (
                <div className="border border-border rounded-lg p-3">
                  <h3 className="text-sm font-medium mb-2">Suplentes ({props.reserves.length})</h3>
                  <ul className="text-sm text-muted space-y-0.5">
                    {[...props.reserves].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                      <li key={p.id}>{p.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {props.type === 'training' && (
            <>
              <div className="border border-border rounded-lg p-3">
                <h3 className="text-sm font-medium mb-2">Jugadores ({props.attendees.length})</h3>
                <ul className="text-sm text-muted space-y-0.5">
                  {[...props.attendees].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              </div>
              <div className="border border-border rounded-lg p-3">
                <h3 className="text-sm font-medium mb-2">Entrenadores ({props.coaches.length})</h3>
                <ul className="text-sm text-muted space-y-0.5">
                  {[...props.coaches].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-error mt-3">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={props.onClose}
            className="flex-1 py-2 rounded-lg font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !time || !isValidTime(time) || !isNewLocationComplete(locationSelection) || (props.type === 'external_match' && !isExternalTeamSelectionComplete(opponentSelection))}
            className="flex-1 py-2 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
