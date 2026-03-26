import { useState, useRef, useEffect } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useNavigate } from 'react-router-dom';
import type { Team, Player, ShirtColor, Location, LocationSelection } from '../types';
import { isNewLocationComplete } from '../types';
import { ShirtIcon, ShuffleIcon } from './icons';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDateShort, isValidTime } from '../utils/dateUtils';
import { shuffle } from '../utils/shuffle';
import { defaultTeamName } from '../utils/teamSorter';
import LocationPicker from './LocationPicker';
import TimeInput from './TimeInput';
import Tooltip from './Tooltip';

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
  | { type: 'training'; attendees: Player[]; coaches: Player[] }
);

function initialTeamNames(count: number, suggestedNames: string[]): string[] {
  const shuffled = shuffle(suggestedNames);
  return Array.from({ length: count }, (_, i) =>
    i < shuffled.length ? shuffled[i] : defaultTeamName(i),
  );
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
  const [teamNames, setTeamNames] = useState(() =>
    props.type === 'match' ? initialTeamNames(props.teams.length, suggestedTeamNames) : [],
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

    if (props.type === 'match') {
      const trimmedNames = teamNames.map((n) => n.trim());
      if (trimmedNames.some((n) => n === '')) {
        setError('Todos los equipos deben tener un nombre.');
        return;
      }
    }

    setSaving(true);

    // 1. Resolve location
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
        played_at_time: time || null,
        location_id: locationId,
        cost: cost.trim() ? parseInt(cost.trim(), 10) : null,
        payee_alias_cbu: payee.trim() || null,
      })
      .select('id, short_id')
      .single();

    if (eventError || !event) {
      setError(eventError?.message ?? 'Error al crear la fecha.');
      setSaving(false);
      return;
    }

    if (props.type === 'match') {
      // 3. Insert match
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({ event_id: event.id })
        .select('id')
        .single();

      if (matchError || !match) {
        setError(matchError?.message ?? 'Error al crear el partido.');
        setSaving(false);
        return;
      }

      // 4. Insert teams
      const trimmedNames = teamNames.map((n) => n.trim());
      const teamInserts = trimmedNames.map((teamName, i) => ({
        match_id: match.id,
        name: teamName,
        shirt_color: shirtColors[i],
      }));

      const { data: insertedTeams, error: teamsError } = await supabase
        .from('match_teams')
        .insert(teamInserts)
        .select('id');

      if (teamsError || !insertedTeams) {
        setError(teamsError?.message ?? 'Error al crear los equipos.');
        setSaving(false);
        return;
      }

      // 5. Insert team players
      const playerInserts = insertedTeams.flatMap((dbTeam, i) =>
        props.teams[i].players.map((p) => ({
          match_team_id: dbTeam.id,
          player_id: p.id,
        })),
      );

      if (playerInserts.length > 0) {
        const { error: playersError } = await supabase
          .from('match_team_players')
          .insert(playerInserts);

        if (playersError) {
          setError(playersError.message);
          setSaving(false);
          return;
        }
      }

      // 6. Insert reserves
      if (props.reserves.length > 0) {
        const reserveInserts = props.reserves.map((p) => ({
          match_id: match.id,
          player_id: p.id,
        }));

        const { error: reservesError } = await supabase
          .from('match_reserves')
          .insert(reserveInserts);

        if (reservesError) {
          setError(reservesError.message);
          setSaving(false);
          return;
        }
      }
    } else {
      // Training flow
      // 3. Insert training
      const { data: training, error: trainingError } = await supabase
        .from('trainings')
        .insert({ event_id: event.id })
        .select('id')
        .single();

      if (trainingError || !training) {
        setError(trainingError?.message ?? 'Error al crear el entrenamiento.');
        setSaving(false);
        return;
      }

      // 4. Insert attendees
      if (props.attendees.length > 0) {
        const attendeeInserts = props.attendees.map((p) => ({
          training_id: training.id,
          player_id: p.id,
        }));

        const { error: attendeesError } = await supabase
          .from('training_attendees')
          .insert(attendeeInserts);

        if (attendeesError) {
          setError(attendeesError.message);
          setSaving(false);
          return;
        }
      }

      // 5. Insert coaches
      if (props.coaches.length > 0) {
        const coachInserts = props.coaches.map((p) => ({
          training_id: training.id,
          player_id: p.id,
        }));

        const { error: coachesError } = await supabase
          .from('training_coaches')
          .insert(coachInserts);

        if (coachesError) {
          setError(coachesError.message);
          setSaving(false);
          return;
        }
      }
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
          {props.type === 'match' ? 'Guardar partido' : 'Guardar entrenamiento'}
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
            <label className="block text-sm font-medium mb-1">Cancha</label>
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

          {props.type === 'match' && teamNames.map((teamName, i) => (
            <div key={i} className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => handleTeamNameChange(i, e.target.value)}
                  required
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
                {suggestedTeamNames.length > 0 && (
                  <Tooltip label="Nombre aleatorio">
                    <button
                      type="button"
                      onClick={() => handleRandomizeName(i)}
                      className="p-2 rounded-lg border border-border hover:bg-border-subtle transition-colors"
                    >
                      <ShuffleIcon className="w-5 h-5 text-muted" />
                    </button>
                  </Tooltip>
                )}
                <Tooltip label={shirtColors[i] === 'light' ? 'Camiseta clara' : 'Camiseta oscura'}>
                  <button
                    type="button"
                    onClick={() => handleShirtColorToggle(i)}
                    className="p-2 rounded-lg border border-border hover:bg-border-subtle transition-colors"
                  >
                    <ShirtIcon
                      className={`w-5 h-5 ${shirtColors[i] === 'light' ? 'text-shirt-light' : 'text-shirt-dark'}`}
                    />
                  </button>
                </Tooltip>
              </div>
              <ul className="mt-2 text-sm text-muted space-y-0.5">
                {props.teams[i].players.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            </div>
          ))}

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
            disabled={saving || !isValidTime(time) || !isNewLocationComplete(locationSelection)}
            className="flex-1 py-2 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
